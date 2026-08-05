/**
 * "Previously considered" — earlier candidates for this client, suggested for a
 * new brief by must-have overlap.
 *
 * Everything is read through the caller's own Supabase client, so RLS keeps
 * other clients' pipelines out. The query only ever looks at matches that were
 * already approved as visible to this organisation for a prior position, so no
 * new candidate is exposed here. No score is read and none is returned.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { reasonLabel } from "@/lib/client-decision-reasons";
import {
  buildPreviouslyConsidered,
  type ConsideredInput,
  type ConsideredRow,
} from "@/lib/client-previously-considered";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export type PreviouslyConsideredDTO = {
  candidate_profile_id: string;
  candidate_name: string;
  headline: string | null;
  prior_position_id: string;
  prior_position_title: string;
  decision: "hold" | "not_moving_forward";
  reason_label: string | null;
  decided_at: string;
  when_label: string;
  decision_label: string;
  overlap: string[];
  overlap_count: number;
  suggested_because: string;
};

function toDTO(row: ConsideredRow): PreviouslyConsideredDTO {
  return {
    candidate_profile_id: row.candidate_profile_id,
    candidate_name: row.candidate_name,
    headline: row.headline,
    prior_position_id: row.prior_position_id,
    prior_position_title: row.prior_position_title,
    decision: row.decision,
    reason_label: row.reason_label,
    decided_at: row.decided_at,
    when_label: row.when_label,
    decision_label: row.decision_label,
    overlap: row.overlap,
    overlap_count: row.overlap_count,
    suggested_because: row.suggested_because,
  };
}

export const listPreviouslyConsidered = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; positionId: string }) =>
    z
      .object({ orgId: z.string().uuid(), positionId: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ candidates: PreviouslyConsideredDTO[] }> => {
    // The brief we are matching against.
    const { data: brief, error: briefErr } = await context.supabase
      .from("positions")
      .select("id, requirements")
      .eq("id", data.positionId)
      .eq("organization_id", data.orgId)
      .maybeSingle();
    if (briefErr) throw new Error(briefErr.message);
    if (!brief) throw new Error("position_not_found");

    // Earlier decisions this client recorded, on matches that were visible to
    // them, for other positions. Reversed decisions do not count.
    const { data: decisions, error: decErr } = await context.supabase
      .from("client_decisions")
      .select(
        "id, decision, reason_code, created_at, candidate_match_id, candidate_matches!inner(id, position_id, organization_id, client_visibility, candidate_profile_id)",
      )
      .eq("organization_id", data.orgId)
      .in("decision", ["hold", "not_moving_forward"])
      .is("reversed_at", null)
      .eq("candidate_matches.client_visibility", "visible")
      .neq("candidate_matches.position_id", data.positionId)
      .order("created_at", { ascending: false })
      .limit(400);
    if (decErr) throw new Error(decErr.message);

    const rows = ((decisions as AnyRow[]) ?? []).filter(
      (d) => d.candidate_matches?.candidate_profile_id && d.candidate_matches?.position_id,
    );
    if (rows.length === 0) return { candidates: [] };

    const profileIds = Array.from(
      new Set(rows.map((d) => d.candidate_matches.candidate_profile_id as string)),
    );
    const priorPositionIds = Array.from(
      new Set(rows.map((d) => d.candidate_matches.position_id as string)),
    );

    // Client-safe candidate fields only: no email, phone, or score.
    const [{ data: profiles }, { data: priorPositions }, { data: memory }] = await Promise.all([
      context.supabase
        .from("candidate_profiles")
        .select("id, full_name, headline, expires_at")
        .in("id", profileIds),
      context.supabase
        .from("positions")
        .select("id, title, requirements")
        .eq("organization_id", data.orgId)
        .in("id", priorPositionIds),
      context.supabase
        .from("talent_memory")
        .select("candidate_profile_id, consent_status, consent_expires_at")
        .eq("organization_id", data.orgId)
        .in("candidate_profile_id", profileIds),
    ]);

    const profileById = new Map<string, AnyRow>(
      ((profiles as AnyRow[]) ?? []).map((p) => [p.id as string, p]),
    );
    const positionById = new Map<string, AnyRow>(
      ((priorPositions as AnyRow[]) ?? []).map((p) => [p.id as string, p]),
    );
    // A withdrawn or declined consent record closes the window immediately.
    const consentById = new Map<string, string | null>();
    for (const m of (memory as AnyRow[]) ?? []) {
      const blocked = m.consent_status === "withdrawn" || m.consent_status === "declined";
      consentById.set(
        m.candidate_profile_id as string,
        blocked ? new Date(0).toISOString() : ((m.consent_expires_at as string | null) ?? null),
      );
    }

    const inputs: ConsideredInput[] = [];
    for (const d of rows) {
      const match = d.candidate_matches as AnyRow;
      const profile = profileById.get(match.candidate_profile_id as string);
      const prior = positionById.get(match.position_id as string);
      if (!profile || !prior) continue;
      // Retention expiry on the profile, or the recorded consent window.
      const retention = (profile.expires_at as string | null) ?? null;
      const consent = consentById.get(profile.id as string) ?? null;
      const earliest =
        retention && consent
          ? new Date(retention) < new Date(consent)
            ? retention
            : consent
          : (retention ?? consent);
      inputs.push({
        candidate_profile_id: profile.id as string,
        candidate_name: (profile.full_name as string) || "Candidate",
        headline: (profile.headline as string | null) ?? null,
        prior_position_id: prior.id as string,
        prior_position_title: (prior.title as string) || "An earlier role",
        prior_requirements: (prior.requirements as AnyRow[]) ?? [],
        decision: d.decision as "hold" | "not_moving_forward",
        reason_code: (d.reason_code as string | null) ?? null,
        reason_label: reasonLabel(d.reason_code as string | null),
        decided_at: d.created_at as string,
        consent_expires_at: earliest,
      });
    }

    const built = buildPreviouslyConsidered(
      (brief as AnyRow).requirements as AnyRow[],
      inputs,
    ).slice(0, 20);
    return { candidates: built.map(toDTO) };
  });

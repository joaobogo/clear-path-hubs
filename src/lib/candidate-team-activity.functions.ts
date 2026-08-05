import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertWorkspaceArea } from "@/lib/collaborator-roles.server";
import {
  VIEW_ACTION,
  VIEW_DEDUPE_MINUTES,
  sortActivity,
  type TeamActivityEntry,
} from "@/lib/candidate-team-activity";

const CLIENT_ROLES = ["client_admin", "client_editor", "client_viewer"] as const;

type ProfileRow = { auth_user_id: string; full_name: string | null; email: string | null };

function nameOf(p: ProfileRow | undefined): string {
  return p?.full_name?.trim() || p?.email?.trim() || "A teammate";
}

/**
 * Everyone in this workspace who counts as "your team": client members only.
 * Platform staff are excluded even when they hold a membership row, so our own
 * activity never shows up in a client's audit view.
 */
async function clientTeamUserIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  orgId: string,
): Promise<Set<string>> {
  const { data: members } = await admin
    .from("memberships")
    .select("user_id, role")
    .eq("organization_id", orgId)
    .in("role", CLIENT_ROLES as unknown as string[]);

  const ids = Array.from(
    new Set(((members ?? []) as { user_id: string }[]).map((m) => m.user_id).filter(Boolean)),
  );
  if (ids.length === 0) return new Set();

  const { data: staff } = await admin
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", ids)
    .eq("role", "admin");
  const staffIds = new Set(((staff ?? []) as { user_id: string }[]).map((s) => s.user_id));

  return new Set(ids.filter((id) => !staffIds.has(id)));
}

/**
 * Records that a client team member opened this candidate.
 *
 * This is the only source of "viewed" entries — we never infer a view from a
 * page load elsewhere. Repeat opens inside a short window collapse into the
 * first one so the list stays readable.
 */
export const recordCandidateView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { orgId: string; matchId: string }) =>
    z.object({ orgId: z.string().uuid(), matchId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const role = await assertWorkspaceArea(
      context.supabase,
      context.userId,
      data.orgId,
      "candidates",
    );
    // Our own staff looking at a candidate is not client team activity.
    if (!CLIENT_ROLES.includes(role as (typeof CLIENT_ROLES)[number])) return { recorded: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: match } = await supabaseAdmin
      .from("candidate_matches")
      .select("id")
      .eq("id", data.matchId)
      .eq("organization_id", data.orgId)
      .maybeSingle();
    if (!match) return { recorded: false };

    const since = new Date(Date.now() - VIEW_DEDUPE_MINUTES * 60_000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("audit_events")
      .select("id")
      .eq("entity_type", "candidate_match")
      .eq("entity_id", data.matchId)
      .eq("actor_user_id", context.userId)
      .eq("action", VIEW_ACTION)
      .gte("created_at", since)
      .limit(1)
      .maybeSingle();
    if (recent) return { recorded: false };

    const { error } = await supabaseAdmin.from("audit_events").insert({
      organization_id: data.orgId,
      actor_user_id: context.userId,
      entity_type: "candidate_match",
      entity_id: data.matchId,
      action: VIEW_ACTION,
      after_state: { source: "client_candidate_detail" },
    });
    // A missed view record must never break the page the client is reading.
    if (error) console.error("[recordCandidateView]", error.message);
    return { recorded: !error };
  });

/**
 * Recorded activity from the client's own team on one candidate.
 * Every entry maps to a stored row: an audit view event, a shared comment, a
 * submitted scorecard, or a client-recorded decision.
 */
export const getCandidateTeamActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { orgId: string; matchId: string }) =>
    z.object({ orgId: z.string().uuid(), matchId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ context, data }): Promise<{ entries: TeamActivityEntry[] }> => {
    await assertWorkspaceArea(context.supabase, context.userId, data.orgId, "candidates");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: match } = await supabaseAdmin
      .from("candidate_matches")
      .select("id")
      .eq("id", data.matchId)
      .eq("organization_id", data.orgId)
      .maybeSingle();
    if (!match) throw new Error("That candidate is not in this workspace.");

    const team = await clientTeamUserIds(supabaseAdmin, data.orgId);
    if (team.size === 0) return { entries: [] };
    const teamIds = Array.from(team);

    const [views, notes, cards, decisions] = await Promise.all([
      supabaseAdmin
        .from("audit_events")
        .select("id, actor_user_id, created_at")
        .eq("entity_type", "candidate_match")
        .eq("entity_id", data.matchId)
        .eq("action", VIEW_ACTION)
        .in("actor_user_id", teamIds)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("candidate_notes")
        .select("id, author_user_id, created_at")
        .eq("candidate_match_id", data.matchId)
        .eq("organization_id", data.orgId)
        .in("author_user_id", teamIds)
        .is("superseded_at", null)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("interview_scorecards")
        .select("id, reviewer_user_id, submitted_at, recommendation")
        .eq("candidate_match_id", data.matchId)
        .eq("organization_id", data.orgId)
        .in("reviewer_user_id", teamIds)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("client_decisions")
        .select("id, actor_user_id, created_at, decision, recorded_by_staff")
        .eq("candidate_match_id", data.matchId)
        .eq("organization_id", data.orgId)
        .in("actor_user_id", teamIds)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const firstError = [views, notes, cards, decisions].find((r) => r.error)?.error;
    if (firstError) throw new Error(firstError.message);

    const viewRows = (views.data ?? []) as { id: string; actor_user_id: string; created_at: string }[];
    const noteRows = (notes.data ?? []) as { id: string; author_user_id: string; created_at: string }[];
    const cardRows = (cards.data ?? []) as {
      id: string;
      reviewer_user_id: string;
      submitted_at: string;
      recommendation: string | null;
    }[];
    const decisionRows = ((decisions.data ?? []) as {
      id: string;
      actor_user_id: string;
      created_at: string;
      decision: string | null;
      recorded_by_staff: boolean | null;
    }[]
    // A decision our team entered on the client's behalf is not their activity.
    ).filter((d) => d.recorded_by_staff !== true);

    const userIds = Array.from(
      new Set([
        ...viewRows.map((r) => r.actor_user_id),
        ...noteRows.map((r) => r.author_user_id),
        ...cardRows.map((r) => r.reviewer_user_id),
        ...decisionRows.map((r) => r.actor_user_id),
      ]),
    );

    const profiles = userIds.length
      ? ((
          await supabaseAdmin
            .from("profiles")
            .select("auth_user_id, full_name, email")
            .in("auth_user_id", userIds)
        ).data as ProfileRow[] | null) ?? []
      : [];
    const byId = new Map(profiles.map((p) => [p.auth_user_id, p]));

    const entries: TeamActivityEntry[] = [
      ...viewRows.map((r) => ({
        id: `view:${r.id}`,
        kind: "viewed" as const,
        actorName: nameOf(byId.get(r.actor_user_id)),
        at: r.created_at,
        detail: null,
      })),
      ...noteRows.map((r) => ({
        id: `note:${r.id}`,
        kind: "commented" as const,
        actorName: nameOf(byId.get(r.author_user_id)),
        at: r.created_at,
        detail: null,
      })),
      ...cardRows.map((r) => ({
        id: `card:${r.id}`,
        kind: "feedback" as const,
        actorName: nameOf(byId.get(r.reviewer_user_id)),
        at: r.submitted_at,
        detail: r.recommendation ? String(r.recommendation).replace(/_/g, " ") : null,
      })),
      ...decisionRows.map((r) => ({
        id: `decision:${r.id}`,
        kind: "decision" as const,
        actorName: nameOf(byId.get(r.actor_user_id)),
        at: r.created_at,
        detail: r.decision ? String(r.decision).replace(/_/g, " ") : null,
      })),
    ];

    return { entries: sortActivity(entries) };
  });

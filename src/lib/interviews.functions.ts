// Interview records — read-only history for the Client interviews page.
// TaaSFlow no longer schedules interviews: the employer and the candidate
// arrange them directly, outside the platform. Rows that already exist in the
// database (and their feedback) stay readable here.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertWorkspaceAccess } from "@/lib/authz/workspace-access";




// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export type InterviewStatus =
  | "requested"
  | "scheduling"
  | "scheduled"
  | "completed"
  | "cancelled";

const INTERVIEW_TYPES = [
  "phone_screen",
  "video_call",
  "onsite",
  "technical",
  "panel",
  "final",
  "other",
] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];

// ─── Read ───────────────────────────────────────────────────────────────────

export type InterviewDTO = {
  id: string;
  organization_id: string;
  position_id: string;
  candidate_match_id: string;
  candidate_submission_id: string | null;
  status: InterviewStatus;
  interview_type: InterviewType | null;
  scheduled_at: string | null;
  notes: string | null;
  feedback: string | null;
  requested_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  candidate: { id: string; name: string; email: string | null } | null;
  position: { id: string; title: string; reference: string | null } | null;
};

function toDTO(row: AnyRow, candidate: AnyRow | null, position: AnyRow | null): InterviewDTO {
  return {
    id: row.id,
    organization_id: row.organization_id,
    position_id: row.position_id,
    candidate_match_id: row.candidate_match_id,
    candidate_submission_id: row.candidate_submission_id ?? null,
    status: row.status as InterviewStatus,
    interview_type: (row.interview_type ?? null) as InterviewType | null,
    scheduled_at: row.scheduled_at ?? null,
    notes: row.notes ?? null,
    feedback: row.feedback ?? null,
    requested_at: row.requested_at,
    completed_at: row.completed_at ?? null,
    cancelled_at: row.cancelled_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    candidate: candidate
      ? {
          id: candidate.id as string,
          name: (candidate.full_name as string) ?? "Candidate",
          email: (candidate.email as string) ?? null,
        }
      : null,
    position: position
      ? {
          id: position.id as string,
          title: (position.title as string) ?? "Position",
          reference: (position.reference_code as string) ?? null,
        }
      : null,
  };
}

export const listClientInterviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { orgId: string; status?: InterviewStatus | "all" }) =>
      z
        .object({
          orgId: z.string().uuid(),
          status: z
            .enum(["all", "requested", "scheduling", "scheduled", "completed", "cancelled"])
            .optional(),
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertWorkspaceAccess(context.supabase, context.userId, data.orgId);

    let q = context.supabase
      .from("interviews")
      .select("*")
      .eq("organization_id", data.orgId)
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .order("requested_at", { ascending: false });
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    // History only: completed or cancelled interviews, and legacy rows that
    // had a time on them. Requests that never got a time are not shown.
    const list = ((rows as AnyRow[]) ?? []).filter(
      (row) => row.status === "completed" || row.status === "cancelled" || !!row.scheduled_at,
    );
    if (list.length === 0) return { interviews: [] as InterviewDTO[] };

    const matchIds = Array.from(new Set(list.map((r) => r.candidate_match_id).filter(Boolean)));
    const positionIds = Array.from(new Set(list.map((r) => r.position_id).filter(Boolean)));

    const [matchesRes, positionsRes] = await Promise.all([
      context.supabase
        .from("candidate_matches")
        .select("id, stage, candidate_profile_id, candidate_profiles:candidate_profile_id(id, full_name, email)")
        .in("id", matchIds),
      context.supabase
        .from("positions")
        .select("id, title, reference_code")
        .in("id", positionIds),
    ]);
    // Employer roles hold no RLS read on candidate_profiles, so the embed comes
    // back null and every card would degrade to "Candidate". Fill the already
    // authorized rows through the shared hydration helper (no contact fields).
    const { hydrateClientCandidateProfiles } = await import(
      "@/lib/client-candidate-hydrate.server"
    );
    const hydratedMatches = await hydrateClientCandidateProfiles(
      (matchesRes.data as AnyRow[]) ?? [],
    );
    const matchMap = new Map<string, AnyRow>();
    for (const m of hydratedMatches) {
      const cp = (m as AnyRow).candidate_profiles;
      matchMap.set(m.id as string, cp ?? null);
    }
    const posMap = new Map<string, AnyRow>();
    for (const p of ((positionsRes.data as AnyRow[]) ?? [])) posMap.set(p.id as string, p);

    return {
      interviews: list.map((r) => {
        const match = hydratedMatches.find((m: any) => m.id === r.candidate_match_id);
        return toDTO(
          r,
          match ? { ...matchMap.get(r.candidate_match_id), stage: match.stage } : null,
          posMap.get(r.position_id) ?? null,
        );
      }),
    };


  });

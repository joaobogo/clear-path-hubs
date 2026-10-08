/**
 * Interview figures — the one reader.
 *
 *  - "interviews in a window": legacy interview records completed (or dated in
 *    the past, not cancelled) inside the window, PLUS every other match that
 *    reached the interview stage inside the window. Interviews are arranged
 *    off system, so reaching the stage is what can be proven; a match counts
 *    once.
 *
 * Interview-level visibility narrows rows to assigned interviewers, which is
 * why the figure reads through the organization-scoped reader — otherwise a
 * client's own interviews silently vanish from their own count.
 */
import { readOrgRows } from "@/lib/kpis/org-read.server";
import { WEEKLY_WINDOW_DAYS } from "@/lib/client-weekly-update";
import { distinctInterviewMatches, mergeInterviewActivity } from "@/lib/kpis/interview-activity";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export function interviewWindow(
  now: Date = new Date(),
  days: number = WEEKLY_WINDOW_DAYS,
): { startIso: string; endIso: string } {
  return {
    startIso: new Date(now.getTime() - days * 86_400_000).toISOString(),
    endIso: now.toISOString(),
  };
}

/** Interview activity inside a window: legacy rows plus matches that reached the interview stage. */
export async function loadInterviewsHeld(
  supabase: AnyRow,
  orgId: string,
  window: { startIso: string; endIso: string },
  now: Date = new Date(),
): Promise<AnyRow[]> {
  const { startIso, endIso } = window;
  const legacy = await loadLegacyInterviewsHeld(supabase, orgId, window, now);
  const [history, decisions] = await Promise.all([
    readOrgRows(
      supabase,
      orgId,
      "candidate_stage_history",
      "candidate_match_id, position_id, created_at",
      (q) => q.eq("to_stage", "interview_process").gte("created_at", startIso).lte("created_at", endIso),
    ),
    readOrgRows(
      supabase,
      orgId,
      "client_decisions",
      "candidate_match_id, created_at",
      (q) =>
        q
          .eq("decision", "request_interview")
          .is("reversed_at", null)
          .gte("created_at", startIso)
          .lte("created_at", endIso),
    ),
  ]);
  const entries = [
    ...history.map((h) => ({
      candidate_match_id: String(h.candidate_match_id ?? ""),
      position_id: (h.position_id as string | null) ?? null,
      at: String(h.created_at),
    })),
    ...decisions.map((d) => ({
      candidate_match_id: String(d.candidate_match_id ?? ""),
      position_id: null,
      at: String(d.created_at),
    })),
  ];
  return mergeInterviewActivity(legacy, entries);
}

async function loadLegacyInterviewsHeld(
  supabase: AnyRow,
  orgId: string,
  window: { startIso: string; endIso: string },
  now: Date = new Date(),
): Promise<AnyRow[]> {
  const { startIso, endIso } = window;
  const rows = await readOrgRows(
    supabase,
    orgId,
    "interviews",
    "id, position_id, candidate_match_id, status, scheduled_at, completed_at, cancelled_at, positions(title)",
    (q) =>
      q
        .or(
          `and(completed_at.gte.${startIso},completed_at.lte.${endIso}),and(scheduled_at.gte.${startIso},scheduled_at.lte.${endIso})`,
        )
        .order("scheduled_at", { ascending: true }),
  );
  const nowIso = now.toISOString();
  return rows.filter((i) => {
    if (String(i.status ?? "") === "cancelled" || i.cancelled_at) return false;
    const completed = i.completed_at ? String(i.completed_at) : null;
    if (completed && completed >= startIso && completed <= endIso) return true;
    const scheduled = i.scheduled_at ? String(i.scheduled_at) : null;
    return Boolean(
      scheduled && scheduled >= startIso && scheduled <= endIso && scheduled <= nowIso,
    );
  });
}

export async function countInterviewsHeld(
  supabase: AnyRow,
  orgId: string,
  window: { startIso: string; endIso: string },
  now: Date = new Date(),
): Promise<number> {
  return distinctInterviewMatches(await loadInterviewsHeld(supabase, orgId, window, now));
}

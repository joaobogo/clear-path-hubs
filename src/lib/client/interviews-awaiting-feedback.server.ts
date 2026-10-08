// Canonical source of truth for interviews awaiting feedback.
// Both the Interviews page and the Home page read from here.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertWorkspaceAccess } from "@/lib/authz/workspace-access";
import { buildStageFeedbackItems } from "@/lib/interview-feedback-queue";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export type FeedbackQueueItem = {
  interview_id: string;
  candidate_match_id: string;
  candidate_name: string;
  position_id: string | null;
  position_title: string;
  interview_type: string | null;
  /** When the interview happened (completed, else its scheduled time). */
  happened_at: string | null;
  /** Prompted the day after the interview — a date, never an email nag. */
  prompt_from: string | null;
  status: string;
};

const DAY = 86_400_000;

function happenedAt(iv: AnyRow): string | null {
  return (iv.scheduled_at as string | null) ?? null;
}

/**
 * Fetches every interview that has happened and still has no feedback from anyone on the
 * client side.
 */
export async function getInterviewsAwaitingFeedback(
  supabase: any,
  orgId: string,
): Promise<FeedbackQueueItem[]> {
  const legacy = await getLegacyInterviewsAwaitingFeedback(supabase, orgId);
  const stage = await getStageMatchesAwaitingFeedback(supabase, orgId, {
    coveredMatchIds: new Set(legacy.map((i) => i.candidate_match_id)),
  });
  return [...legacy, ...stage];
}

/**
 * Matches at the interview stage (interviews happen off system) that have no
 * submitted feedback yet. Optionally narrowed to one match and wider stages.
 */
export async function getStageMatchesAwaitingFeedback(
  supabase: any,
  orgId: string,
  opts: { matchId?: string; stages?: readonly string[]; coveredMatchIds?: ReadonlySet<string> } = {},
): Promise<FeedbackQueueItem[]> {
  const stages = opts.stages ?? ["interview_process"];
  let q = supabase
    .from("candidate_matches")
    .select("id, position_id, stage, updated_at, positions:position_id(title)")
    .eq("organization_id", orgId)
    .eq("client_visibility", "visible")
    .in("stage", stages as string[]);
  if (opts.matchId) q = q.eq("id", opts.matchId);
  const { data: matches, error } = await q.limit(200);
  if (error) throw new Error(error.message);
  const list = (matches as AnyRow[] | null) ?? [];
  if (list.length === 0) return [];
  const ids = list.map((m) => m.id as string);

  const [{ data: cards }, { data: hist }] = await Promise.all([
    supabase
      .from("interview_scorecards")
      .select("candidate_match_id")
      .eq("organization_id", orgId)
      .in("candidate_match_id", ids),
    supabase
      .from("candidate_stage_history")
      .select("candidate_match_id, created_at")
      .eq("to_stage", "interview_process")
      .in("candidate_match_id", ids),
  ]);
  const scored = new Set(((cards as AnyRow[] | null) ?? []).map((c) => c.candidate_match_id as string));
  const entered = new Map<string, string>();
  for (const h of (hist as AnyRow[] | null) ?? []) {
    const id = h.candidate_match_id as string;
    const at = h.created_at as string;
    if (!entered.has(id) || at > entered.get(id)!) entered.set(id, at);
  }

  const { hydrateClientCandidateProfiles } = await import("@/lib/client-candidate-hydrate.server");
  const { data: nameData } = await supabase
    .from("candidate_matches")
    .select("id, candidate_profile_id, candidate_profiles:candidate_profile_id(id, full_name)")
    .in("id", ids);
  const hydrated = await hydrateClientCandidateProfiles((nameData as AnyRow[]) ?? []);
  const names = new Map<string, string>();
  for (const m of hydrated) {
    const name = (m as AnyRow).candidate_profiles?.full_name as string | undefined;
    if (name) names.set(m.id as string, name);
  }

  return buildStageFeedbackItems({
    matches: list.map((m) => ({
      id: m.id as string,
      stage: m.stage as string,
      position_id: (m.position_id as string) ?? null,
      position_title: m.positions?.title ?? null,
      candidate_name: names.get(m.id as string) ?? null,
      entered_at: entered.get(m.id as string) ?? null,
      updated_at: (m.updated_at as string) ?? null,
    })),
    scoredMatchIds: scored,
    coveredMatchIds: opts.coveredMatchIds,
    stages,
  });
}

async function getLegacyInterviewsAwaitingFeedback(
  supabase: any,
  orgId: string,
): Promise<FeedbackQueueItem[]> {
  const nowIso = new Date().toISOString();
  
  // 1. Load interviews that are in a state where feedback is possible (scheduled or completed)
  const { data: rows, error } = await supabase
    .from("interviews")
    .select(
      "id, candidate_match_id, position_id, status, scheduled_at, completed_at, interview_type, candidate_matches:candidate_match_id(candidate_profiles:candidate_profile_id(full_name)), positions:position_id(title)",
    )
    .eq("organization_id", orgId)
    .in("status", ["scheduled", "completed"])
    .order("scheduled_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);

  // 2. Filter to only those that have actually happened
  const list = ((rows as AnyRow[] | null) ?? []).filter((iv) => {
    const happened = happenedAt(iv);
    return !!happened && happened < nowIso;
  });
  if (list.length === 0) return [];

  // 3. Exclude those that already have a scorecard
  const { data: cards } = await supabase
    .from("interview_scorecards")
    .select("interview_id")
    .eq("organization_id", orgId)
    .in(
      "interview_id",
      list.map((i) => i.id as string),
    );
  const done = new Set(((cards as AnyRow[] | null) ?? []).map((c) => c.interview_id as string));

  // 4. Resolve candidate names properly (hydration)
  const matchIds = list.map((iv) => iv.candidate_match_id as string);
  const { data: nameData } = await supabase
    .from("candidate_matches")
    .select("id, candidate_profile_id, candidate_profiles:candidate_profile_id(id, full_name)")
    .in("id", Array.from(new Set(matchIds)));
  
  const { hydrateClientCandidateProfiles } = await import(
    "@/lib/client-candidate-hydrate.server"
  );
  const hydrated = await hydrateClientCandidateProfiles((nameData as AnyRow[]) ?? []);
  const nameMap = new Map<string, string>();
  for (const m of hydrated) {
    const name = (m as AnyRow).candidate_profiles?.full_name as string | undefined;
    if (name) nameMap.set(m.id as string, name);
  }

  return list
    .filter((iv) => !done.has(iv.id as string))
    .map((iv) => {
      const happened = happenedAt(iv);
      const candidateName = nameMap.get(iv.candidate_match_id as string) || 
                           (iv.candidate_matches?.candidate_profiles?.full_name as string) || 
                           "Candidate";
      return {
        interview_id: iv.id as string,
        candidate_match_id: iv.candidate_match_id as string,
        candidate_name: candidateName,
        position_id: (iv.position_id as string) ?? null,
        position_title: iv.positions?.title ?? "Your role",
        interview_type: (iv.interview_type as string) ?? null,
        happened_at: happened,
        prompt_from: happened ? new Date(new Date(happened).getTime() + DAY).toISOString() : null,
        status: iv.status as string,
      };
    })
    .sort((a, b) => (a.happened_at ?? "").localeCompare(b.happened_at ?? ""));
}

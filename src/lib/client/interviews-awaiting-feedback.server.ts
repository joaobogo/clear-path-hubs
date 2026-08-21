// Canonical source of truth for interviews awaiting feedback.
// Both the Interviews page and the Home page read from here.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertWorkspaceAccess } from "@/lib/authz/workspace-access";

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

import type { MatchStage } from "@/lib/client-match-stage";

/**
 * Recruitment stage changes happen exclusively through the Candidates Kanban.
 * Candidate lists and profile cards remain navigational, not interview or
 * offer action surfaces. Keep the component API for callers during migration.
 */
export function advanceFor(
  _stage: MatchStage,
  _interviewRequested = false,
  _interviewCalledOff = false,
  _interviewCompleted = false,
): null {
  return null;
}

export function CandidatePrimaryAction(_props: {
  orgId: string;
  matchId: string;
  stage: MatchStage;
  candidateName: string;
  size?: "sm" | "default";
  fitLabel?: string | null;
  score?: number | null;
  interviewRequested?: boolean;
  interviewCalledOff?: boolean;
  interviewCompleted?: boolean;
}): null {
  return null;
}

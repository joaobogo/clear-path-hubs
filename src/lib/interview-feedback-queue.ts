/**
 * Interview feedback is keyed on the candidate match, not on a scheduled slot.
 * Interviews are arranged off system, so a candidate at the interview stage is
 * enough reason to ask for feedback. A queue item for such a match carries a
 * synthetic id ("match:<uuid>"); the first submission creates one lightweight
 * completed `interviews` row so scorecards, calibration and KPIs keep working.
 *
 * Pure: no I/O, so the rules are testable.
 */

export const MATCH_TARGET_PREFIX = "match:";

export type FeedbackTarget =
  | { kind: "interview"; interviewId: string }
  | { kind: "match"; matchId: string };

export function matchTargetId(matchId: string): string {
  return `${MATCH_TARGET_PREFIX}${matchId}`;
}

export function parseFeedbackTarget(id: string): FeedbackTarget {
  return id.startsWith(MATCH_TARGET_PREFIX)
    ? { kind: "match", matchId: id.slice(MATCH_TARGET_PREFIX.length) }
    : { kind: "interview", interviewId: id };
}

export type InterviewRowLite = { id: string; status: string; created_at?: string | null };

/**
 * What to do with the interview record behind a match when feedback arrives.
 *  - reuse: an interview row already exists; `advance` lists the status steps
 *    still needed to reach "completed" (the lifecycle trigger only allows
 *    scheduled -> completed, and "scheduled" needs a time).
 *  - create: no usable row; insert one as scheduled (now), then complete it.
 * A retry finds the completed row and reuses it, so the row exists exactly once.
 */
export type InterviewRecordPlan =
  | { kind: "reuse"; id: string; advance: Array<"scheduled" | "completed"> }
  | { kind: "create" };

export function planInterviewRecord(rows: readonly InterviewRowLite[]): InterviewRecordPlan {
  const live = rows.filter((r) => r.status !== "cancelled");
  const newestFirst = (a: InterviewRowLite, b: InterviewRowLite) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
  const completed = live.filter((r) => r.status === "completed").sort(newestFirst)[0];
  if (completed) return { kind: "reuse", id: completed.id, advance: [] };
  const scheduled = live.filter((r) => r.status === "scheduled").sort(newestFirst)[0];
  if (scheduled) return { kind: "reuse", id: scheduled.id, advance: ["completed"] };
  const open = live.filter((r) => r.status === "requested" || r.status === "scheduling").sort(newestFirst)[0];
  if (open) return { kind: "reuse", id: open.id, advance: ["scheduled", "completed"] };
  return { kind: "create" };
}

export type StageMatchLite = {
  id: string;
  stage: string;
  position_id: string | null;
  position_title?: string | null;
  candidate_name?: string | null;
  /** When the match reached the interview stage, if known. */
  entered_at?: string | null;
  updated_at?: string | null;
};

export type StageFeedbackItem = {
  interview_id: string;
  candidate_match_id: string;
  candidate_name: string;
  position_id: string | null;
  position_title: string;
  interview_type: string | null;
  happened_at: string | null;
  prompt_from: string | null;
  status: string;
};

/**
 * Matches at the interview stage with no submitted feedback, as queue items.
 * `scoredMatchIds` holds matches with any scorecard; `coveredMatchIds` holds
 * matches already listed through a legacy interview row (no duplicates).
 */
export function buildStageFeedbackItems(args: {
  matches: readonly StageMatchLite[];
  scoredMatchIds: ReadonlySet<string>;
  coveredMatchIds?: ReadonlySet<string>;
  stages?: readonly string[];
}): StageFeedbackItem[] {
  const stages = args.stages ?? ["interview_process"];
  return args.matches
    .filter(
      (m) =>
        stages.includes(m.stage) &&
        !args.scoredMatchIds.has(m.id) &&
        !(args.coveredMatchIds?.has(m.id) ?? false),
    )
    .map((m) => {
      const at = m.entered_at ?? m.updated_at ?? null;
      return {
        interview_id: matchTargetId(m.id),
        candidate_match_id: m.id,
        candidate_name: m.candidate_name || "Candidate",
        position_id: m.position_id,
        position_title: m.position_title || "Your role",
        interview_type: null,
        happened_at: at,
        prompt_from: at,
        status: "interview_stage",
      };
    })
    .sort((a, b) => (a.happened_at ?? "").localeCompare(b.happened_at ?? ""));
}

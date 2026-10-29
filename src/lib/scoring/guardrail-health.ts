/**
 * Scoring guardrail health: four checks that each mean a candidate or a role
 * is being judged on something it should not be, or not judged at all.
 *
 *  1. Ineligible with no reason on record: eligibility_status 'not_eligible'
 *     but no failed eligibility_checks row. Eligibility comes from dealbreaker
 *     answers only, and every exclusion must carry the answer behind it.
 *  2. Unscored and unowned: no current score, not being processed, older
 *     than an hour, and no open admin task. Nobody is going to look at it.
 *  3. Roles whose criteria state a protected attribute (the same detector
 *     the editors and the publish gate use).
 *  4. Current scores from an older engine on active roles: the rescore that
 *     would bring them up to date has not run.
 *
 * Pure: the scan (freshness-reconcile.server.ts) reads the rows and this
 * decides. Counts only; nothing here changes data.
 */
import { storedPositionProtectedCriteria } from "@/lib/positions/protected-criteria-fields";

export const UNSCORED_GRACE_MS = 60 * 60 * 1000;

/** States in which the pipeline still owns the match. */
export const PROCESSING_STATES = new Set([
  "queued",
  "parsing",
  "parsed",
  "enriching",
  "ready_to_score",
  "scoring",
]);

export type GuardrailMatch = {
  id: string;
  position_id: string | null;
  eligibility_status: string | null;
  current_score_run_id: string | null;
  processing_state: string | null;
  created_at: string | null;
};

export type GuardrailPosition = {
  id: string;
  title: string | null;
  status: string | null;
  requirements?: unknown;
  preferred_requirements?: unknown;
  dealbreakers?: unknown;
};

export type GuardrailInputs = {
  now: Date;
  engineVersion: string;
  matches: GuardrailMatch[];
  /** Matches with at least one eligibility_checks row in status 'failed'. */
  failedCheckMatchIds: ReadonlySet<string>;
  /** Matches with an open or in-progress admin task. */
  openTaskMatchIds: ReadonlySet<string>;
  positions: GuardrailPosition[];
  screeningQuestions: Array<{ position_id: string; question: string | null }>;
  /** engine_version of each match's current score run. */
  currentRunEngine: ReadonlyMap<string, string | null>;
};

export type GuardrailReport = {
  ineligible_without_failed_check: string[];
  unscored_without_task: string[];
  positions_with_protected_wording: Array<{ position_id: string; title: string; findings: number }>;
  outdated_engine_scores: string[];
};

const CLOSED_POSITION = new Set(["filled", "closed", "archived"]);

export function flagGuardrails(i: GuardrailInputs): GuardrailReport {
  const positionsById = new Map(i.positions.map((p) => [p.id, p]));
  const cutoff = i.now.getTime() - UNSCORED_GRACE_MS;

  const ineligible = i.matches
    .filter((m) => m.eligibility_status === "not_eligible" && !i.failedCheckMatchIds.has(m.id))
    .map((m) => m.id);

  const unscored = i.matches
    .filter((m) => {
      if (m.current_score_run_id) return false;
      if (PROCESSING_STATES.has(String(m.processing_state ?? ""))) return false;
      const created = m.created_at ? Date.parse(m.created_at) : NaN;
      if (!Number.isFinite(created) || created > cutoff) return false;
      const pos = m.position_id ? positionsById.get(m.position_id) : undefined;
      if (pos && CLOSED_POSITION.has(String(pos.status ?? ""))) return false;
      return !i.openTaskMatchIds.has(m.id);
    })
    .map((m) => m.id);

  const questionsBy = new Map<string, Array<{ question: string | null }>>();
  for (const q of i.screeningQuestions) {
    const list = questionsBy.get(q.position_id) ?? [];
    list.push({ question: q.question });
    questionsBy.set(q.position_id, list);
  }
  const protectedWording = i.positions
    .filter((p) => !CLOSED_POSITION.has(String(p.status ?? "")))
    .map((p) => ({
      position_id: p.id,
      title: p.title ?? "Untitled role",
      findings: storedPositionProtectedCriteria({
        title: p.title,
        requirements: p.requirements,
        preferred_requirements: p.preferred_requirements,
        dealbreakers: p.dealbreakers,
        screening_questions: questionsBy.get(p.id) ?? [],
      }).length,
    }))
    .filter((p) => p.findings > 0);

  const outdated = i.matches
    .filter((m) => {
      if (!m.current_score_run_id) return false;
      const pos = m.position_id ? positionsById.get(m.position_id) : undefined;
      if (!pos || pos.status !== "active") return false;
      const engine = i.currentRunEngine.get(m.id);
      return Boolean(engine) && engine !== i.engineVersion;
    })
    .map((m) => m.id);

  return {
    ineligible_without_failed_check: ineligible,
    unscored_without_task: unscored,
    positions_with_protected_wording: protectedWording,
    outdated_engine_scores: outdated,
  };
}

/** The rows the admin dashboard shows: a label, a count and what to do. */
export function guardrailRows(r: GuardrailReport): Array<{ key: string; label: string; count: number; action: string }> {
  return [
    {
      key: "ineligible_without_failed_check",
      label: "Ineligible with no failed dealbreaker on record",
      count: r.ineligible_without_failed_check.length,
      action: "Run recompute_screening_eligibility for the role (migration 0005), or rescore the candidates.",
    },
    {
      key: "unscored_without_task",
      label: "Unscored for over an hour with no admin task",
      count: r.unscored_without_task.length,
      action: "Open the candidate and retry processing; the pipeline opens a task on its next run.",
    },
    {
      key: "positions_with_protected_wording",
      label: "Roles whose criteria state a protected attribute",
      count: r.positions_with_protected_wording.length,
      action: "Open the role editor and use the suggested wording; publishing is blocked until then.",
    },
    {
      key: "outdated_engine_scores",
      label: "Scores from an older engine on active roles",
      count: r.outdated_engine_scores.length,
      action: "Re-score all candidates from Admin → Operations; scores update as each batch completes.",
    },
  ];
}

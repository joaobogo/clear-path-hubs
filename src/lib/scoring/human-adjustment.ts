/**
 * Human overrides that reach the client (Prompt 10) — pure math.
 *
 * A reviewer can mark a requirement met, not met or not applicable with a
 * mandatory written reason. That verdict never edits a completed score run:
 * it produces a NEW run, recomputed here with the same fit math and the same
 * versioned calibration the machine run used, and stamped
 * `evaluation_method = 'human_adjusted'`.
 *
 * Two facts stay separable forever:
 *   • which criteria the machine decided, and
 *   • which criteria a person decided, with who and why.
 *
 * "Not applicable" is REMOVED from the denominator (fit-math semantics), never
 * scored as a zero — an irrelevant requirement must not punish a candidate.
 */
import { computeFit } from "./fit-math";
import { classifyBand, bandToFitLabel } from "./bands";
import type { EngineCalibration } from "./engine-calibration";

export const HUMAN_EVALUATION_METHOD = "human_adjusted" as const;

export type HumanVerdict = "met" | "not_met" | "not_applicable";

export const HUMAN_VERDICTS: readonly HumanVerdict[] = [
  "met",
  "not_met",
  "not_applicable",
];

/** Minimum characters for the mandatory written reason. */
export const MIN_REASON_LENGTH = 8;

export type HumanVerdictInput = {
  /** Requirement id as recorded on the run's requirement_assessment. */
  requirement_id: string;
  verdict: HumanVerdict;
  reason: string;
};

export type HumanVerdictRecord = HumanVerdictInput & {
  actor_user_id: string;
  actor_name: string;
  at: string;
  /** What the machine had decided before the person stepped in. */
  machine_status: string | null;
};

/** Shape this module needs from a stored run's requirement_assessment row. */
export type AssessmentRow = {
  id: string;
  text?: string;
  required?: boolean;
  status: string;
  /** Set when a person, not the engine, decided this row. */
  human_verified?: boolean;
  human_verdict?: HumanVerdict;
  human_reason?: string;
  human_actor_user_id?: string | null;
  human_actor_name?: string | null;
  human_at?: string | null;
  machine_status?: string | null;
  not_applicable?: boolean;
  [key: string]: unknown;
};

export function isVerdict(value: unknown): value is HumanVerdict {
  return typeof value === "string" && (HUMAN_VERDICTS as readonly string[]).includes(value);
}

/**
 * Apply verdicts onto the machine assessment. Rows without a verdict are
 * returned untouched — including any human decision recorded on an earlier
 * adjusted run, so verification accumulates instead of being lost.
 */
export function applyHumanVerdicts(
  assessment: readonly AssessmentRow[],
  verdicts: readonly HumanVerdictRecord[],
): { assessment: AssessmentRow[]; applied: HumanVerdictRecord[]; unknownIds: string[] } {
  const byId = new Map<string, HumanVerdictRecord>();
  for (const v of verdicts) byId.set(v.requirement_id, v);

  const applied: HumanVerdictRecord[] = [];
  const out = assessment.map((row) => {
    const v = byId.get(row.id);
    if (!v) return { ...row };
    byId.delete(row.id);
    applied.push(v);
    const machineStatus = row.machine_status ?? row.status ?? null;
    return {
      ...row,
      status: v.verdict === "met" ? "met" : v.verdict === "not_met" ? "missing" : row.status,
      not_applicable: v.verdict === "not_applicable",
      human_verified: true,
      human_verdict: v.verdict,
      human_reason: v.reason,
      human_actor_user_id: v.actor_user_id,
      human_actor_name: v.actor_name,
      human_at: v.at,
      machine_status: machineStatus,
      needs_validation: false,
    } satisfies AssessmentRow;
  });

  return { assessment: out, applied, unknownIds: [...byId.keys()] };
}

function creditOf(row: AssessmentRow, cal: EngineCalibration): number | null {
  if (row.not_applicable) return null; // removed from the denominator
  switch (row.status) {
    case "met":
      return 1;
    case "partial":
      return cal.partial_credit;
    case "unknown":
      return cal.unknown_credit;
    default:
      return 0;
  }
}

export type AdjustedScore = {
  raw_score: number;
  final_score: number;
  /** Ceiling in force, or null when nothing clamped this run. */
  applied_cap: number | null;
  applied_caps: Array<{ reason: string; cap: number; before: number }>;
  cap_reason: string | null;
  must_have_coverage: number;
  preferred_coverage: number;
  fit_label: "strong_fit" | "worth_considering" | "not_a_fit" | "unknown";
  category_weights: { must_have: number; preferred: number; screening_alignment: number };
};

/**
 * Recompute the composite from an adjusted assessment.
 *
 * `carriedCaps` are the input-derived ceilings the machine run already
 * established (a dealbreaker answer, an unparsed CV). A human verdict on a
 * requirement cannot make those facts go away, so they are carried forward
 * verbatim; the must-have floor cap is recomputed because coverage changed.
 */
export function recomputeAdjustedScore(input: {
  assessment: readonly AssessmentRow[];
  /** 0..1 screening alignment from the machine run, or null when none. */
  screeningAlignment: number | null;
  calibration: EngineCalibration;
  carriedCaps?: ReadonlyArray<{ reason: string; cap: number }>;
  /** True when the run being adjusted had no readable CV text. */
  unknownLabel?: boolean;
}): AdjustedScore {
  const cal = input.calibration;
  const rows = input.assessment;
  const must = rows.filter((r) => r.required !== false && !r.not_applicable);
  const pref = rows.filter((r) => r.required === false && !r.not_applicable);

  const credit = (r: AssessmentRow) => creditOf(r, cal) ?? 0;
  const must_have_coverage = must.length
    ? must.reduce((s, r) => s + credit(r), 0) / must.length
    : 0;
  const preferred_coverage = pref.length
    ? pref.reduce((s, r) => s + credit(r), 0) / pref.length
    : 0;

  const fit = computeFit([
    {
      key: "must_have",
      weight_pct: cal.base_weights.must_have * 100,
      criteria: must.map((r) => ({ key: r.id, score: credit(r) * 100 })),
    },
    {
      key: "preferred",
      weight_pct: cal.base_weights.preferred * 100,
      criteria: pref.map((r) => ({ key: r.id, score: credit(r) * 100 })),
    },
    {
      key: "screening_alignment",
      weight_pct: cal.base_weights.screening_alignment * 100,
      criteria:
        input.screeningAlignment == null
          ? []
          : [{ key: "screening", score: input.screeningAlignment * 100 }],
    },
  ]);

  const applied = (key: string) =>
    (fit.dimensions.find((d) => d.key === key)?.score ?? null) !== null;
  const rawWeights = {
    must_have: applied("must_have") ? cal.base_weights.must_have : 0,
    preferred: applied("preferred") ? cal.base_weights.preferred : 0,
    screening_alignment: applied("screening_alignment")
      ? cal.base_weights.screening_alignment
      : 0,
  };
  const weightTotal =
    rawWeights.must_have + rawWeights.preferred + rawWeights.screening_alignment || 1;
  const category_weights = {
    must_have: rawWeights.must_have / weightTotal,
    preferred: rawWeights.preferred / weightTotal,
    screening_alignment: rawWeights.screening_alignment / weightTotal,
  };

  let score01 = (fit.fit_score ?? 0) / 100;
  const raw_score = Math.round(score01 * 1000) / 10;
  const applied_caps: AdjustedScore["applied_caps"] = [];
  const applyCap = (reason: string, cap: number) => {
    if (score01 <= cap) return;
    applied_caps.push({ reason, cap, before: Math.round(score01 * 10000) / 10000 });
    score01 = cap;
  };
  for (const c of input.carriedCaps ?? []) applyCap(c.reason, c.cap);
  if (must.length && must_have_coverage < cal.must_have_floor) {
    applyCap(
      `must_have_floor: ${Math.round(must_have_coverage * 100)}% must-have coverage is below the rubric floor of ${Math.round(cal.must_have_floor * 100)}%`,
      cal.must_have_floor_cap,
    );
  }

  const final_score = Math.round(score01 * 1000) / 10;
  const band = bandToFitLabel(classifyBand(final_score));
  const fit_label: AdjustedScore["fit_label"] = input.unknownLabel
    ? "unknown"
    : band === "strong_fit" && must_have_coverage < cal.strong_fit.min_must_have_coverage
      ? "worth_considering"
      : band;

  return {
    raw_score,
    final_score,
    // Null, never a mirror of raw_score, when no ceiling was in force.
    applied_cap: applied_caps.length
      ? applied_caps[applied_caps.length - 1]!.cap
      : null,
    applied_caps,
    cap_reason: applied_caps.length ? applied_caps.map((c) => c.reason).join(" | ") : null,
    must_have_coverage: Math.round(must_have_coverage * 10000) / 10000,
    preferred_coverage: Math.round(preferred_coverage * 10000) / 10000,
    fit_label,
    category_weights,
  };
}

export type VerifiedShare = {
  total: number;
  human_verified: number;
  machine_derived: number;
  /** 0..1 share of the applied score weight resting on human-verified criteria. */
  weighted_share: number;
  /** 0..1 plain count share. */
  count_share: number;
  /** Staff-safe plain-language line. */
  line: string;
};

/**
 * How much of the shown score rests on human-verified criteria, weighted by
 * the category weights actually applied to the run.
 */
export function verifiedScoreShare(
  assessment: readonly AssessmentRow[],
  weights: { must_have: number; preferred: number; screening_alignment: number },
): VerifiedShare {
  const scored = assessment.filter((r) => !r.not_applicable);
  const total = scored.length;
  const human = scored.filter((r) => r.human_verified === true).length;

  const bucket = (required: boolean) => scored.filter((r) => (r.required !== false) === required);
  const shareIn = (rows: AssessmentRow[]) =>
    rows.length ? rows.filter((r) => r.human_verified === true).length / rows.length : 0;

  const wMust = weights.must_have;
  const wPref = weights.preferred;
  const denominator = wMust + wPref; // screening answers are not human-verifiable here
  const weighted_share =
    denominator > 0
      ? (shareIn(bucket(true)) * wMust + shareIn(bucket(false)) * wPref) / denominator
      : 0;

  return {
    total,
    human_verified: human,
    machine_derived: total - human,
    weighted_share: Math.round(weighted_share * 10000) / 10000,
    count_share: total ? Math.round((human / total) * 10000) / 10000 : 0,
    line:
      total === 0
        ? "No criteria recorded for this score."
        : human === 0
          ? `All ${total} criteria are machine-derived — none human-verified yet.`
          : `${human} of ${total} criteria human-verified (${Math.round(weighted_share * 100)}% of the score's weight).`,
  };
}

/** Client-safe statement: a person reviewed this. Never the internal note. */
export function clientReviewStatement(input: {
  humanAdjusted: boolean;
  verifiedCount?: number;
}): string | null {
  if (!input.humanAdjusted) return null;
  return input.verifiedCount && input.verifiedCount > 0
    ? `A TaaSFlow specialist reviewed this assessment and verified ${input.verifiedCount} requirement${input.verifiedCount === 1 ? "" : "s"} by hand.`
    : "A TaaSFlow specialist reviewed this assessment by hand.";
}

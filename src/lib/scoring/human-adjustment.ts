/**
 * Human overrides that reach the client (Prompt 10) — pure math.
 *
 * A reviewer can mark a requirement met, partly met, not met or not applicable
 * with a mandatory written reason. That verdict never edits a completed score run:
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
 *
 * A machine re-score never drops the review (26 Nov 2026: one candidate went
 * 31.3, 62.5, 31.3, 31.3, 62.5, 70.0 in an afternoon on identical inputs,
 * because each re-score replaced the reviewed run). The stored verdicts go
 * back on top of every new machine run (planReapply):
 *   • a verdict that differed from the machine when the person decided is
 *     deliberate, and is kept whatever the machine says later;
 *   • a verdict that agreed with the machine follows the machine: it stays
 *     marked as verified while the machine still says the same, and gives way
 *     when the machine's result changes.
 */
import { computeFit } from "./fit-math";
import { classifyBand, bandToFitLabel } from "./bands";
import type { EngineCalibration } from "./engine-calibration";

export const HUMAN_EVALUATION_METHOD = "human_adjusted" as const;

export type HumanVerdict = "met" | "partial" | "not_met" | "not_applicable";

export const HUMAN_VERDICTS: readonly HumanVerdict[] = [
  "met",
  "partial",
  "not_met",
  "not_applicable",
];

/** Format of `result.human_adjustment` written from 26 Nov 2026 (see planReapply). */
export const HUMAN_LEDGER_FORMAT = 2;

/** Minimum characters for the mandatory written reason. */
export const MIN_REASON_LENGTH = 8;

export type HumanVerdictInput = {
  /** Requirement id as recorded on the run's requirement_assessment. */
  requirement_id: string;
  verdict: HumanVerdict;
  reason: string;
};

export type HumanVerdictRecord = HumanVerdictInput & {
  /** The person who made the call; null on older review records. Never the system. */
  actor_user_id: string | null;
  actor_name: string;
  /** When the person made the call (not when it was last re-applied). */
  at: string;
  /** What the machine says for this requirement on the run this record sits on. */
  machine_status: string | null;
  /** The requirement's wording when the person decided, to find it again later. */
  requirement_text?: string | null;
  /** What the machine said when the person decided. Never changes on re-apply. */
  decided_machine_status?: string | null;
  /** True when the system put this verdict back after a machine re-score. */
  reapplied?: boolean;
};

/** A stored verdict with what is needed to decide how it re-applies. */
export type StoredVerdict = HumanVerdictRecord & {
  decided_machine_status: string | null;
  /** The verdict differed from the machine when the person decided. */
  deliberate: boolean;
};

/** One human-adjusted run, as the history a re-apply reads. */
export type HumanRunLedger = {
  run_id: string;
  at: string;
  /** HUMAN_LEDGER_FORMAT when the run carries a complete ledger. */
  format?: number | null;
  verdicts: readonly HumanVerdictRecord[];
  carried_forward?: readonly HumanVerdictRecord[];
  /** The run's requirement rows, for the wording of older records. */
  assessment?: readonly AssessmentRow[];
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
  /** What the machine said when the person decided. */
  human_decided_machine_status?: string | null;
  /** The machine's result has changed since the person decided and still differs. */
  machine_changed_since_review?: boolean;
  /** The verdict was put back by the system after a machine re-score. */
  human_reapplied?: boolean;
  [key: string]: unknown;
};

export function isVerdict(value: unknown): value is HumanVerdict {
  return typeof value === "string" && (HUMAN_VERDICTS as readonly string[]).includes(value);
}

/** The requirement status a verdict stands for; null for "not applicable". */
export function verdictStatus(verdict: HumanVerdict): "met" | "partial" | "missing" | null {
  return verdict === "met"
    ? "met"
    : verdict === "partial"
      ? "partial"
      : verdict === "not_met"
        ? "missing"
        : null;
}

/**
 * A verdict is deliberate when it differed from the machine's status at the
 * moment the person decided. "Not applicable" is always deliberate: the machine
 * never says it. Agreeing with the machine is a confirmation, not a change.
 */
export function isDeliberateVerdict(
  verdict: HumanVerdict,
  decidedMachineStatus: string | null | undefined,
): boolean {
  const status = verdictStatus(verdict);
  if (status === null) return true;
  return status !== String(decidedMachineStatus ?? "");
}

/** Requirement wording reduced to what identifies it across runs. */
export function requirementTextKey(text: unknown): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * The latest verdict a person gave for each requirement, with the machine's
 * status when they first gave it.
 *
 * A run written in HUMAN_LEDGER_FORMAT carries the whole ledger (applied and
 * carried-forward records, each with decided_machine_status), so the newest
 * such run is read alone. Older runs recorded only the machine status of the
 * run they were applied to, and a re-apply by hand overwrote it; for those the
 * history is walked back to the first run in which the person gave that same
 * verdict, and the machine status there is the one they decided against.
 */
export function latestVerdicts(history: readonly HumanRunLedger[]): StoredVerdict[] {
  const runs = [...history].sort((a, b) => a.at.localeCompare(b.at));
  if (runs.length === 0) return [];

  const complete = (r: HumanVerdictRecord, run: HumanRunLedger): StoredVerdict => {
    const text =
      r.requirement_text ??
      (run.assessment?.find((a) => a.id === r.requirement_id)?.text as string | undefined) ??
      null;
    const decided = r.decided_machine_status ?? r.machine_status ?? null;
    return {
      ...r,
      requirement_text: text,
      decided_machine_status: decided,
      deliberate: isDeliberateVerdict(r.verdict, decided),
    };
  };

  const newest = runs[runs.length - 1];
  if ((newest.format ?? 0) >= HUMAN_LEDGER_FORMAT) {
    return [...newest.verdicts, ...(newest.carried_forward ?? [])].map((r) => complete(r, newest));
  }

  // Older records: newest verdict per requirement, traced to where it began.
  const keyOf = (r: HumanVerdictRecord, run: HumanRunLedger) =>
    requirementTextKey(
      r.requirement_text ?? run.assessment?.find((a) => a.id === r.requirement_id)?.text,
    ) || `id:${r.requirement_id}`;
  const byKey = new Map<string, StoredVerdict>();
  for (const run of runs) {
    const all =
      (run.format ?? 0) >= HUMAN_LEDGER_FORMAT
        ? [...run.verdicts, ...(run.carried_forward ?? [])]
        : run.verdicts;
    for (const r of all) {
      const key = keyOf(r, run);
      const now = complete(r, run);
      const before = byKey.get(key);
      if (before && before.verdict === now.verdict) {
        // Same call as before: the earlier decision stands, on today's row id.
        byKey.set(key, {
          ...before,
          requirement_id: now.requirement_id,
          machine_status: now.machine_status,
          reason: now.reason || before.reason,
        });
      } else {
        byKey.set(key, now);
      }
    }
  }
  return [...byKey.values()];
}

export type ReapplyPlan = {
  /** Verdicts that go onto the machine rows: deliberate ones, and confirmations the machine still agrees with. */
  apply: HumanVerdictRecord[];
  /** Confirmations the machine has since moved away from: the row follows the machine. */
  carried_forward: HumanVerdictRecord[];
  /** Verdicts whose requirement is no longer on the role. */
  dropped: Array<{ requirement_id: string; requirement_text: string | null }>;
};

/**
 * Decide what each stored verdict does on a new machine assessment.
 * A verdict finds its requirement by wording first (ids are positions, and a
 * role's requirements can be reordered), then by id.
 */
export function planReapply(
  machine: readonly AssessmentRow[],
  stored: readonly StoredVerdict[],
): ReapplyPlan {
  const byText = new Map<string, AssessmentRow>();
  for (const row of machine) {
    const key = requirementTextKey(row.text);
    if (key && !byText.has(key)) byText.set(key, row);
  }
  const plan: ReapplyPlan = { apply: [], carried_forward: [], dropped: [] };
  const taken = new Set<string>();
  for (const v of stored) {
    const textKey = requirementTextKey(v.requirement_text);
    const row = textKey ? byText.get(textKey) : machine.find((r) => r.id === v.requirement_id);
    if (!row || taken.has(row.id)) {
      plan.dropped.push({
        requirement_id: v.requirement_id,
        requirement_text: v.requirement_text ?? null,
      });
      continue;
    }
    taken.add(row.id);
    const machineNow = String(row.machine_status ?? row.status ?? "");
    const { deliberate: _deliberate, ...rest } = v;
    const record: HumanVerdictRecord = {
      ...rest,
      requirement_id: row.id,
      requirement_text: (row.text as string | undefined) ?? v.requirement_text ?? null,
      machine_status: machineNow || null,
      decided_machine_status: v.decided_machine_status,
    };
    if (v.deliberate || verdictStatus(v.verdict) === machineNow) plan.apply.push(record);
    else plan.carried_forward.push(record);
  }
  return plan;
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
    const decided = v.decided_machine_status ?? machineStatus;
    const status = verdictStatus(v.verdict);
    return {
      ...row,
      status: status ?? row.status,
      not_applicable: v.verdict === "not_applicable",
      human_verified: true,
      human_verdict: v.verdict,
      human_reason: v.reason,
      human_actor_user_id: v.actor_user_id,
      human_actor_name: v.actor_name,
      human_at: v.at,
      machine_status: machineStatus,
      human_decided_machine_status: decided,
      // The machine has moved since the person decided, and still disagrees:
      // the verdict is kept, and the review screen says what the machine says now.
      machine_changed_since_review:
        status !== null && machineStatus !== decided && machineStatus !== status,
      human_reapplied: v.reapplied === true,
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
    screening_alignment: applied("screening_alignment") ? cal.base_weights.screening_alignment : 0,
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
    // Reported on the same 0-100 scale as raw_score/final_score, because this
    // value is persisted to score_runs.applied_cap, which the database checks
    // with `final_score <= applied_cap`. Caps are authored 0-1 in calibration.
    applied_cap: applied_caps.length
      ? Math.round(Math.min(...applied_caps.map((c) => c.cap)) * 1000) / 10
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

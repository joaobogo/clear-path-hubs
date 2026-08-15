/**
 * Score freshness — Prompt 24.
 *
 * A score run stores when it ran and a hash of its inputs. Nothing until now
 * told a recruiter that the profile or the role brief moved afterwards. This
 * module answers one question: is what I am looking at still about the current
 * facts?
 *
 * Regeneration is never applied silently. A stale run stays visible exactly as
 * the client last saw it; the newer result is *offered*.
 */

export type FreshnessInput = {
  /** When the visible run was computed. */
  scored_at: string | Date | null | undefined;
  /** Hash of the inputs that produced the visible run. */
  scored_input_hash?: string | null;
  /** Hash of the inputs as they stand right now, if already computed. */
  current_input_hash?: string | null;
  /** Last change to the candidate's profile or evidence. */
  profile_updated_at?: string | Date | null;
  /** Last change to the approved role brief or its criteria. */
  brief_updated_at?: string | Date | null;
  /** Engine version that produced the run, and the one running today. */
  scored_engine_version?: string | null;
  current_engine_version?: string | null;
  /**
   * Calibration set that produced the run, and the one in force today. A
   * calibration change alters what the same evidence is worth, so a score
   * computed under an older calibration is stale even if nothing else moved.
   */
  scored_calibration_version?: string | null;
  current_calibration_version?: string | null;
  /** When the approved criteria (rubric version) for the role last changed. */
  criteria_updated_at?: string | Date | null;
};

export type StaleReasonCode =
  | "profile_changed"
  | "brief_changed"
  | "inputs_changed"
  | "engine_changed"
  | "calibration_changed"
  | "criteria_changed"
  // Codes written to candidate_matches.score_stale_reasons by the database
  // invalidation triggers. They are recorded facts, not timestamp inferences.
  | "requirements_changed"
  | "screening_changed"
  | "rubric_superseded"
  | "new_cv";

export type StaleReason = {
  code: StaleReasonCode;
  /** Plain sentence a recruiter can read without training. Never contains internal identifiers. */
  label: string;
  /**
   * Exact internal detail (engine/calibration identifiers) for staff surfaces
   * only. Never rendered in client-facing views.
   */
  detail?: string;
};

export type Freshness = {
  state: "current" | "stale" | "unknown";
  reasons: StaleReason[];
  /** One line for badges and list views. */
  summary: string;
  /**
   * True when a rescore would be worth offering. Never used to trigger one
   * automatically.
   */
  offer_rescore: boolean;
};

const time = (v: unknown): number | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
};

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

export function assessFreshness(input: FreshnessInput): Freshness {
  const scored = time(input.scored_at);
  if (scored === null) {
    return {
      state: "unknown",
      reasons: [],
      summary: "We cannot tell when this was last assessed.",
      offer_rescore: true,
    };
  }

  const reasons: StaleReason[] = [];

  // A bare row timestamp is NOT evidence that anything relevant moved: editing
  // an unrelated field on the role (or touching a profile) bumps updated_at
  // without changing a single scoring input. Staleness therefore comes from two
  // sources only: the recorded score_stale flag (see mergeStoredStaleness) and
  // an actual fingerprint/version difference against the run below.
  const scoredHash = str(input.scored_input_hash);
  const currentHash = str(input.current_input_hash);
  if (scoredHash && currentHash && scoredHash !== currentHash) {
    reasons.push({
      code: "inputs_changed",
      label: "The inputs behind this result are no longer the current ones.",
    });
  }

  // Only the base version is compared: a role-family suffix ("…+engineering")
  // still applies today, so it must not read as a change.
  const base = (v: string) => v.split("+")[0]!;
  const scoredCal = str(input.scored_calibration_version);
  const currentCal = str(input.current_calibration_version);
  if (scoredCal && currentCal && base(scoredCal) !== base(currentCal)) {
    reasons.push({
      code: "calibration_changed",
      label: "The way requirements are weighted changed after this was assessed.",
    });
  }

  const scoredEngine = str(input.scored_engine_version);
  const currentEngine = str(input.current_engine_version);
  if (scoredEngine && currentEngine && scoredEngine !== currentEngine) {
    reasons.push({
      code: "engine_changed",
      label: "Assessed with an earlier scoring version — ask us to reassess.",
      detail: `Assessed with engine ${scoredEngine}; the current version is ${currentEngine}.`,
    });
  }

  if (reasons.length === 0) {
    return {
      state: "current",
      reasons: [],
      summary: "Assessed against the current profile and role brief.",
      offer_rescore: false,
    };
  }

  return {
    state: "stale",
    reasons,
    summary:
      reasons.length === 1
        ? reasons[0]!.label
        : `${reasons.length} things changed after this was assessed.`,
    offer_rescore: true,
  };
}

/**
 * What a client sees while a newer run exists. The visible result never
 * changes underneath them — the new one is an offer with a named action.
 */
export function rescoreOffer(freshness: Freshness): {
  show: boolean;
  headline: string;
  body: string;
  action_label: string;
} | null {
  if (!freshness.offer_rescore) return null;
  return {
    show: true,
    headline: "A newer assessment is available",
    body: `${freshness.summary} You are still looking at the earlier result until you choose to update it.`,
    action_label: "Show the updated assessment",
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Stored staleness (Prompt 9)
//
// Timestamp inference above answers "might this have moved?". The database
// invalidation triggers answer "this did move, and here is what changed".
// Stored reasons always win, and they are what the nightly reconciliation and
// every staff surface read.
// ───────────────────────────────────────────────────────────────────────────────

export type StoredStaleness = {
  score_stale?: boolean | null;
  score_stale_reasons?: string[] | null;
  score_stale_at?: string | null;
  rescore_queued_at?: string | null;
};

const STORED_LABELS: Record<string, string> = {
  requirements_changed: "The role's requirements changed after this was assessed.",
  screening_changed: "The screening questions for this role changed after this was assessed.",
  rubric_superseded: "The approved scoring criteria for this role were replaced.",
  new_cv: "The candidate attached a newer CV after this was assessed.",
};

export function storedStaleReasons(stored: StoredStaleness | null | undefined): StaleReason[] {
  const codes = Array.isArray(stored?.score_stale_reasons) ? stored!.score_stale_reasons! : [];
  return codes
    .filter((c): c is string => typeof c === "string" && c.trim() !== "")
    .map((code) => ({
      code: code as StaleReasonCode,
      label: STORED_LABELS[code] ?? "Something behind this assessment changed.",
    }));
}

/**
 * Merges the recorded staleness flag on the match with the inferred assessment.
 * A recorded flag is authoritative: it means an invalidation actually fired.
 */
export function mergeStoredStaleness(
  freshness: Freshness,
  stored: StoredStaleness | null | undefined,
): Freshness {
  if (!stored?.score_stale) return freshness;
  const seen = new Set(freshness.reasons.map((r) => r.code));
  const reasons = [
    ...freshness.reasons,
    ...storedStaleReasons(stored).filter((r) => !seen.has(r.code)),
  ];
  return {
    state: "stale",
    reasons,
    summary:
      reasons.length === 1
        ? reasons[0]!.label
        : `${reasons.length} things changed after this was assessed.`,
    offer_rescore: true,
  };
}

export type RecheckState = {
  /** True when the visible band must be presented as provisional. */
  rechecking: boolean;
  /** Short label for badges: never a number, never a silent omission. */
  label: string;
  /** One line clients can read. */
  detail: string;
  /** True once a rescore has actually been queued. */
  queued: boolean;
};

/**
 * Client-facing framing. A stale score is never shown as current and the
 * candidate is never hidden: the band renders with a "being re-checked" state
 * while the rescore is queued.
 */
export function recheckState(
  freshness: Freshness | null | undefined,
  stored?: StoredStaleness | null,
): RecheckState {
  const stale = stored?.score_stale === true || freshness?.state === "stale";
  if (!stale) {
    return { rechecking: false, label: "", detail: "", queued: false };
  }
  const queued = Boolean(stored?.rescore_queued_at);
  return {
    rechecking: true,
    label: "Being re-checked",
    detail: queued
      ? "The role or the candidate's evidence changed, so we're reassessing this fit. The earlier assessment stays visible until the new one is ready."
      : "The role or the candidate's evidence changed after this assessment. A reassessment is on its way.",
    queued,
  };
}

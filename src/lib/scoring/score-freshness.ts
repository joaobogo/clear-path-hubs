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
};

export type StaleReasonCode =
  | "profile_changed"
  | "brief_changed"
  | "inputs_changed"
  | "engine_changed";

export type StaleReason = {
  code: StaleReasonCode;
  /** Plain sentence a recruiter can read without training. */
  label: string;
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

  const profile = time(input.profile_updated_at);
  if (profile !== null && profile > scored) {
    reasons.push({
      code: "profile_changed",
      label: "The candidate's profile or evidence changed after this was assessed.",
    });
  }

  const brief = time(input.brief_updated_at);
  if (brief !== null && brief > scored) {
    reasons.push({
      code: "brief_changed",
      label: "The role brief changed after this was assessed.",
    });
  }

  const scoredHash = str(input.scored_input_hash);
  const currentHash = str(input.current_input_hash);
  if (scoredHash && currentHash && scoredHash !== currentHash) {
    reasons.push({
      code: "inputs_changed",
      label: "The inputs behind this result are no longer the current ones.",
    });
  }

  const scoredEngine = str(input.scored_engine_version);
  const currentEngine = str(input.current_engine_version);
  if (scoredEngine && currentEngine && scoredEngine !== currentEngine) {
    reasons.push({
      code: "engine_changed",
      label: `Assessed with engine ${scoredEngine}; the current version is ${currentEngine}.`,
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

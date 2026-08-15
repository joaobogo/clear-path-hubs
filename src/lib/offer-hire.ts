/**
 * Offer and hire confirmation tracking — pure logic, safe on client and server.
 *
 * Two rules live here and nowhere else:
 *  1. A position cannot be closed as filled without a confirmed hire record.
 *  2. Guarantee windows are DERIVED from the recorded start date. They are
 *     never typed in by hand.
 *
 * No revenue forecasting, no commission maths.
 */

export const DEFAULT_GUARANTEE_DAYS = 90;

export type HireStatus =
  | "offer_drafted"
  | "offer_sent"
  | "offer_negotiating"
  | "offer_accepted"
  | "offer_declined"
  | "hire_confirmed"
  | "closed_lost";

export const OFFER_STATUS_LABEL: Record<HireStatus, string> = {
  offer_drafted: "Offer drafted",
  offer_sent: "Offer extended",
  offer_negotiating: "Negotiating",
  offer_accepted: "Offer accepted",
  offer_declined: "Offer declined",
  hire_confirmed: "Hire confirmed",
  closed_lost: "Closed lost",
};

/** Outcomes an admin can record against a live offer. */
export const OFFER_OUTCOMES = [
  { value: "offer_sent", label: "Offer extended" },
  { value: "offer_negotiating", label: "Negotiating" },
  { value: "offer_accepted", label: "Accepted" },
  { value: "offer_declined", label: "Declined" },
  { value: "hire_confirmed", label: "Hire confirmed" },
  { value: "closed_lost", label: "Closed lost" },
] as const satisfies ReadonlyArray<{ value: HireStatus; label: string }>;

export type OfferOutcome = (typeof OFFER_OUTCOMES)[number]["value"];

/** Outcomes that require a reason before they can be recorded. */
export const OUTCOMES_REQUIRING_REASON: readonly OfferOutcome[] = [
  "offer_declined",
  "closed_lost",
];

export const CLOSE_REASONS = [
  { value: "candidate_declined", label: "Candidate declined" },
  { value: "counter_offer", label: "Counter-offer at current employer" },
  { value: "other_offer_accepted", label: "Accepted another offer" },
  { value: "compensation_mismatch", label: "Compensation mismatch" },
  { value: "role_paused", label: "Role paused" },
  { value: "budget", label: "Budget change" },
  { value: "timing", label: "Timing / start date" },
  { value: "culture_fit", label: "Culture / team fit" },
  { value: "background_check", label: "Background / reference check" },
  { value: "position_cancelled", label: "Position cancelled" },
  { value: "other", label: "Other" },
] as const;

export type CloseReason = (typeof CLOSE_REASONS)[number]["value"];

/**
 * Canonical Offer & Hire state definitions.
 *
 * All surfaces (Dashboard, Offers page, Executive, Insights) must use these
 * predicates to ensure counts reconcile.
 *
 * Definitions:
 * - OPEN: Drafted, sent, negotiating, or accepted but not yet confirmed.
 *   These are the candidates currently in the offer process.
 * - DECIDED: The outcome is known (accepted, declined, hired, or lost).
 *   Used as the denominator for acceptance rates.
 * - HIRE: The hire is confirmed (hire_confirmed).
 *   Only these count as hires in finance/reporting.
 * - ACCEPTED: Candidate said yes (offer_accepted or hire_confirmed).
 */

const OPEN: readonly HireStatus[] = [
  "offer_drafted",
  "offer_sent",
  "offer_negotiating",
  "offer_accepted",
];

const DECIDED: readonly HireStatus[] = [
  "offer_accepted",
  "offer_declined",
  "hire_confirmed",
  "closed_lost",
];

/** Statuses that count as an offer having been extended to the candidate. */
const EXTENDED: readonly HireStatus[] = [
  "offer_sent",
  "offer_negotiating",
  "offer_accepted",
  "offer_declined",
  "hire_confirmed",
];

export function isLiveOffer(status: string): boolean {
  return OPEN.includes(status as HireStatus);
}

export function isDecidedOffer(status: string): boolean {
  return DECIDED.includes(status as HireStatus);
}

export function isAcceptedOffer(status: string): boolean {
  return (
    status === "offer_accepted" || status === "hire_confirmed"
  );
}

export function isExtendedOffer(status: string): boolean {
  return EXTENDED.includes(status as HireStatus);
}

/** Only a confirmed hire lets a position close as filled. */
export function qualifiesAsHire(status: string): boolean {
  return status === "hire_confirmed";
}

const DAY = 86_400_000;

/** Adds whole days to a YYYY-MM-DD date, returning YYYY-MM-DD. */
export function addDays(dateISO: string, days: number): string {
  const ms = new Date(`${dateISO.slice(0, 10)}T00:00:00Z`).getTime();
  if (!Number.isFinite(ms)) return dateISO;
  return new Date(ms + days * DAY).toISOString().slice(0, 10);
}

export type GuaranteeWindow = {
  /** Derived start of the guarantee — the recorded start date. */
  starts_on: string;
  /** Derived end date. Never entered by hand. */
  ends_on: string;
  days: number;
  days_remaining: number;
  state: "not_started" | "active" | "elapsed";
};

/**
 * Derives the guarantee window from the recorded start date.
 * Returns null when no start date has been confirmed yet.
 */
export function guaranteeWindow(
  input: {
    start_date?: string | null;
    guarantee_starts_on?: string | null;
    guarantee_days?: number | null;
  },
  now: Date = new Date(),
): GuaranteeWindow | null {
  const start = input.guarantee_starts_on ?? input.start_date ?? null;
  if (!start) return null;
  const days =
    typeof input.guarantee_days === "number" && input.guarantee_days > 0
      ? input.guarantee_days
      : DEFAULT_GUARANTEE_DAYS;
  const starts_on = start.slice(0, 10);
  const ends_on = addDays(starts_on, days);
  const nowMs = now.getTime();
  const startMs = new Date(`${starts_on}T00:00:00Z`).getTime();
  const endMs = new Date(`${ends_on}T00:00:00Z`).getTime();
  const state = nowMs < startMs ? "not_started" : nowMs > endMs ? "elapsed" : "active";
  return {
    starts_on,
    ends_on,
    days,
    days_remaining: Math.max(0, Math.ceil((endMs - nowMs) / DAY)),
    state,
  };
}

export type OfferRow = {
  hire_id: string;
  candidate_match_id: string;
  candidate_profile_id: string;
  candidate_name: string;
  organization_id: string;
  organization_name: string;
  position_id: string;
  position_title: string;
  status: HireStatus;
  owner_name: string | null;
  start_date: string | null;
  guarantee: GuaranteeWindow | null;
  close_reason: CloseReason | null;
  close_reason_notes: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  hired_at: string | null;
  updated_at: string;
};

export type OfferTotals = {
  extended: number;
  accepted: number;
  declined: number;
  hires_confirmed: number;
  start_dates_confirmed: number;
  guarantees_active: number;
  live: number;
};

export function summarise(rows: readonly OfferRow[]): OfferTotals {
  return {
    extended: rows.filter((r) => isExtendedOffer(r.status)).length,
    accepted: rows.filter(
      (r) => r.status === "offer_accepted" || r.status === "hire_confirmed",
    ).length,
    declined: rows.filter((r) => r.status === "offer_declined").length,
    hires_confirmed: rows.filter((r) => qualifiesAsHire(r.status)).length,
    start_dates_confirmed: rows.filter((r) => r.start_date != null).length,
    guarantees_active: rows.filter((r) => r.guarantee?.state === "active").length,
    live: rows.filter((r) => isLiveOffer(r.status)).length,
  };
}

/** Position-level offer tracking payload. */
export type PositionOfferTracking = {
  position_id: string;
  position_title: string;
  position_status: string;
  offers: OfferRow[];
  totals: OfferTotals;
  /** True when the position may be closed as filled. */
  can_close_filled: boolean;
  /** Human explanation when it cannot. */
  close_blocked_reason: string | null;
  generated_at: string;
};

/** Rollup row: a closed-won position missing its hire record. */
export type MissingHireRow = {
  position_id: string;
  position_title: string;
  organization_id: string;
  organization_name: string;
  status: string;
  closed_at: string | null;
};

export type OfferHireRollup = {
  totals: OfferTotals;
  missing_hire_records: MissingHireRow[];
  upcoming_starts: OfferRow[];
  guarantees_active: OfferRow[];
  generated_at: string;
};

export const CLOSE_FILLED_BLOCKED =
  "This role cannot be closed as filled until a hire is confirmed on an offer.";

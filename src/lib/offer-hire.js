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
export const OFFER_STATUS_LABEL = {
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
];
/** Outcomes that require a reason before they can be recorded. */
export const OUTCOMES_REQUIRING_REASON = [
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
];
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
const OPEN = [
    "offer_drafted",
    "offer_sent",
    "offer_negotiating",
    "offer_accepted",
];
const DECIDED = [
    "offer_accepted",
    "offer_declined",
    "hire_confirmed",
    "closed_lost",
];
/** Statuses that count as an offer having been extended to the candidate. */
const EXTENDED = [
    "offer_sent",
    "offer_negotiating",
    "offer_accepted",
    "offer_declined",
    "hire_confirmed",
];
export function isLiveOffer(status) {
    return OPEN.includes(status);
}
export function isDecidedOffer(status) {
    return DECIDED.includes(status);
}
export function isAcceptedOffer(status) {
    return (status === "offer_accepted" || status === "hire_confirmed");
}
export function isExtendedOffer(status) {
    return EXTENDED.includes(status);
}
/** Only a confirmed hire lets a position close as filled. */
export function qualifiesAsHire(status) {
    return status === "hire_confirmed";
}
const DAY = 86400000;
/** Adds whole days to a YYYY-MM-DD date, returning YYYY-MM-DD. */
export function addDays(dateISO, days) {
    const ms = new Date(`${dateISO.slice(0, 10)}T00:00:00Z`).getTime();
    if (!Number.isFinite(ms))
        return dateISO;
    return new Date(ms + days * DAY).toISOString().slice(0, 10);
}
/**
 * Derives the guarantee window from the recorded start date.
 * Returns null when no start date has been confirmed yet.
 */
export function guaranteeWindow(input, now = new Date()) {
    const start = input.guarantee_starts_on ?? input.start_date ?? null;
    if (!start)
        return null;
    const days = typeof input.guarantee_days === "number" && input.guarantee_days > 0
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
export function summarise(rows) {
    // Filters here MUST match theQualifies predicates and outcome labels exactly
    // so the panel numbers reconcile with its own table rows.
    return {
        extended: rows.filter((r) => isExtendedOffer(r.status)).length,
        accepted: rows.filter((r) => isAcceptedOffer(r.status)).length,
        declined: rows.filter((r) => r.status === "offer_declined" || r.status === "closed_lost").length,
        hires_confirmed: rows.filter((r) => qualifiesAsHire(r.status)).length,
        start_dates_confirmed: rows.filter((r) => r.start_date != null && isAcceptedOffer(r.status)).length,
        guarantees_active: rows.filter((r) => r.guarantee?.state === "active" && qualifiesAsHire(r.status)).length,
        live: rows.filter((r) => isLiveOffer(r.status)).length,
    };
}
export const CLOSE_FILLED_BLOCKED = "This role cannot be closed as filled until a hire is confirmed on an offer.";

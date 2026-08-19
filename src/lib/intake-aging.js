/**
 * Intake aging — single source of truth for the clock on unconverted intakes.
 *
 * Age is always derived from `intake_submissions.created_at` (submitted_at).
 * Conversion is derived from an existing linked `position_id`, never from a
 * manual flag, so a converted intake leaves the open list automatically.
 *
 * There is deliberately no lead score and no forecast here: tiers only.
 */
export const INTAKE_AGING_TIER_DAYS = { watch: 1, late: 3, critical: 7 };
export const INTAKE_TIER_LABEL = {
    fresh: "Today",
    watch: "1d+",
    late: "3d+",
    critical: "7d+",
};
export function intakeAgingTier(daysWaiting) {
    if (daysWaiting >= INTAKE_AGING_TIER_DAYS.critical)
        return "critical";
    if (daysWaiting >= INTAKE_AGING_TIER_DAYS.late)
        return "late";
    if (daysWaiting >= INTAKE_AGING_TIER_DAYS.watch)
        return "watch";
    return "fresh";
}
/** Whole days elapsed since submission. */
export function daysWaitingSince(iso, nowMs = Date.now()) {
    if (!iso)
        return 0;
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t))
        return 0;
    return Math.max(0, Math.floor((nowMs - t) / 86400000));
}
/** Filter keys for the aging filter row. `all` keeps every open intake. */
export const INTAKE_AGING_FILTERS = ["all", "watch", "late", "critical"];
export function matchesAgingFilter(tier, filter) {
    switch (filter) {
        case "watch":
            return tier === "watch" || tier === "late" || tier === "critical";
        case "late":
            return tier === "late" || tier === "critical";
        case "critical":
            return tier === "critical";
        case "all":
        default:
            return true;
    }
}
/**
 * Why this intake has not become a position yet. First real blocker wins;
 * `null` means nothing is blocking conversion.
 */
export function intakeBlockingReason(row) {
    if (row.lead_status === "closed")
        return "Marked not proceeding";
    if (!row.organization_id)
        return "No client organization linked";
    if (row.status === "needs_clarification")
        return "Waiting on client clarification";
    if (!row.role_title)
        return "Missing role title";
    if (!row.payload_has_jd)
        return "Missing job description";
    if (!row.owner_user_id)
        return "No owner assigned";
    return null;
}

/**
 * Approvals inbox — pure types and helpers.
 *
 * Four kinds of pending decision, each backed by real state (never a synthetic
 * "pending" flag):
 *  • candidate_visible — the match passed admin review but is still hidden from
 *    the client. Approving runs the canonical `approve_candidate_match` path.
 *  • contact_release   — the client asked for direct contact details
 *    (`client_decisions.decision = 'request_contact_release'`) and the match
 *    has no `contact_released_at` yet.
 *  • shortlist_share   — an active share link contains candidates that are not
 *    client-visible, so the share cannot show them until they are approved.
 *  • publish_position  — the requisition is submitted/under review/approved but
 *    has never been published.
 */
export const APPROVAL_KINDS = [
    "candidate_visible",
    "contact_release",
    "shortlist_share",
    "publish_position",
];
export const APPROVAL_KIND_LABEL = {
    candidate_visible: "Candidate visible to client",
    contact_release: "Contact released",
    shortlist_share: "Shortlist share",
    publish_position: "Publish position",
};
export const APPROVAL_KIND_BLURB = {
    candidate_visible: "Passed admin review, still hidden from the client. Approving publishes through the same gate as the Publish Desk.",
    contact_release: "The client requested direct contact details for a candidate they can already see.",
    shortlist_share: "An active share link includes candidates who are not client-visible yet.",
    publish_position: "A requisition is waiting to go live.",
};
const DAY = 86400000;
export function ageDays(iso, now = Date.now()) {
    if (!iso)
        return 0;
    const t = Date.parse(iso);
    if (Number.isNaN(t))
        return 0;
    return Math.max(0, Math.floor((now - t) / DAY));
}
/** 0–1 day fresh, 2–3 days watch, 4+ overdue. */
export function ageTier(days) {
    if (days >= 4)
        return "overdue";
    if (days >= 2)
        return "watch";
    return "fresh";
}
export const AGE_TIER_LABEL = {
    fresh: "New",
    watch: "Waiting",
    overdue: "Overdue",
};
export function ageLabel(days) {
    if (days <= 0)
        return "today";
    return days === 1 ? "1 day" : `${days} days`;
}
/** Bulk approve is only legal inside one position — never across clients. */
export function bulkEligible(items) {
    if (items.length < 2)
        return false;
    const positions = new Set(items.map((i) => i.position_id ?? ""));
    const orgs = new Set(items.map((i) => i.organization_id ?? ""));
    return (positions.size === 1 &&
        !positions.has("") &&
        orgs.size === 1 &&
        items.every((i) => i.kind === items[0].kind && (i.kind === "publish_position" || i.blockers.length === 0)));
}
export function groupApprovals(items) {
    return APPROVAL_KINDS.map((kind) => ({
        kind,
        label: APPROVAL_KIND_LABEL[kind],
        blurb: APPROVAL_KIND_BLURB[kind],
        items: items
            .filter((i) => i.kind === kind)
            .sort((a, b) => b.age_days - a.age_days || a.target_label.localeCompare(b.target_label)),
    })).filter((g) => g.items.length > 0);
}
/** Decline always needs a written reason; approve does not. */
export const MIN_DECLINE_REASON = 10;

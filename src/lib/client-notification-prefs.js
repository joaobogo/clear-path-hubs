export const NOTIFICATION_EVENTS = [
    {
        key: "pref_shortlist_delivered",
        label: "New shortlist delivered",
        description: "We have released a new set of candidates for one of your roles.",
        modes: ["immediate", "daily", "off"],
        defaultMode: "immediate",
    },
    {
        key: "pref_decision_overdue",
        label: "Decision overdue",
        description: "A candidate has been waiting on your decision past the agreed window.",
        modes: ["immediate", "daily"],
        defaultMode: "immediate",
        lockedReason: "This one can be moved to the digest but not switched off — candidates drop out while a decision waits, and this is the only notice that tells you it is happening.",
    },
    {
        key: "pref_interview_update",
        label: "Interview scheduled or changed",
        description: "A new interview time, a reschedule, or a cancellation.",
        modes: ["immediate", "daily", "off"],
        defaultMode: "immediate",
    },
    {
        key: "pref_offer_response",
        label: "Offer response",
        description: "A candidate has accepted, declined, or countered an offer.",
        modes: ["immediate", "daily", "off"],
        defaultMode: "immediate",
    },
    {
        key: "pref_information_needed",
        label: "Information needed",
        description: "We are blocked on something only your team can answer.",
        modes: ["immediate", "daily"],
        defaultMode: "immediate",
        lockedReason: "This one can be moved to the digest but not switched off — work on the role stops until the answer arrives, so you always get told.",
    },
    {
        key: "pref_weekly_summary",
        label: "Weekly summary",
        description: "One email each Monday: movement, decisions waiting, what is next.",
        modes: ["immediate", "off"],
        defaultMode: "off",
    },
];
export const PREFERENCE_KEYS = NOTIFICATION_EVENTS.map((e) => e.key);
/** The shipped defaults, used whenever a person has no saved row yet. */
export function defaultPreferences() {
    return NOTIFICATION_EVENTS.reduce((acc, spec) => {
        acc[spec.key] = spec.defaultMode;
        return acc;
    }, {});
}
export function specFor(key) {
    const spec = NOTIFICATION_EVENTS.find((e) => e.key === key);
    if (!spec)
        throw new Error(`Unknown notification preference: ${key}`);
    return spec;
}
/** True when the requested mode is one this event actually accepts. */
export function isModeAllowed(key, mode) {
    return specFor(key).modes.includes(mode);
}
export function modeLabel(mode) {
    if (mode === "immediate")
        return "As it happens";
    if (mode === "daily")
        return "Daily digest";
    return "Off";
}
/**
 * Which preference governs an event type. Events with no entry are essential
 * transactional/security notices and are never preference-gated.
 */
export const EVENT_PREFERENCE = {
    candidate_published: "pref_shortlist_delivered",
    shortlist_ready: "pref_shortlist_delivered",
    client_shortlisted: "pref_shortlist_delivered",
    approval_needed: "pref_decision_overdue",
    interview_requested: "pref_interview_update",
    interview_rescheduled: "pref_interview_update",
    candidate_hired: "pref_offer_response",
    client_declined: "pref_offer_response",
    client_information_requested: "pref_information_needed",
    role_information_missing: "pref_information_needed",
};
/** Reads a stored row (or nothing) into a complete, valid preference set. */
export function normalizePreferences(row) {
    const base = defaultPreferences();
    if (!row)
        return base;
    for (const spec of NOTIFICATION_EVENTS) {
        const value = row[spec.key];
        if (typeof value === "string" && isModeAllowed(spec.key, value)) {
            base[spec.key] = value;
        }
    }
    return base;
}

/**
 * Candidate notification preferences — the shared domain model.
 *
 * Stored on `candidate_profiles.consent.notify` so a candidate keeps one set of
 * choices across every application. Rules this module exists to enforce:
 *
 *   1. No all-or-nothing switch. Every event has its own delivery choice:
 *        "immediate"  send as it happens
 *        "digest"     hold it for the daily digest
 *        "off"        no email for that event (the portal still shows it)
 *   2. Interview and document notices carry deadlines, so they can be moved to
 *      the digest but never switched off, and the UI must state why.
 *   3. Talent-network mail is entirely separate and fully optional. Turning it
 *      off can never affect interview or document notices.
 *   4. SMS is only ever offered — and only ever sent — where a verified mobile
 *      number exists.
 */
export const CANDIDATE_PREF_EVENTS = [
    {
        key: "application_received",
        label: "Application received",
        description: "Confirmation that we have your application and what happens next.",
        modes: ["immediate", "digest", "off"],
        defaultMode: "immediate",
        channels: ["email"],
    },
    {
        key: "status_changed",
        label: "Status changed",
        description: "Your application moves forward, or a decision is recorded.",
        modes: ["immediate", "digest", "off"],
        defaultMode: "immediate",
        channels: ["email", "sms"],
    },
    {
        key: "interview_update",
        label: "Interview proposed or changed",
        description: "New times to choose from, a reschedule, or a cancellation.",
        modes: ["immediate", "digest"],
        defaultMode: "immediate",
        channels: ["email", "sms"],
        lockedReason: "These carry a deadline — times are only held for a short window — so they can be moved to the daily digest but not switched off.",
    },
    {
        key: "document_requested",
        label: "Document or answer requested",
        description: "Something we need from you before your application can move on.",
        modes: ["immediate", "digest"],
        defaultMode: "immediate",
        channels: ["email", "sms"],
        lockedReason: "These carry a deadline, so they can be moved to the daily digest but not switched off.",
    },
    {
        key: "team_message",
        label: "Message from the recruiting team",
        description: "A direct message about one of your applications.",
        modes: ["immediate", "digest", "off"],
        defaultMode: "immediate",
        channels: ["email", "sms"],
    },
    {
        key: "matching_roles",
        label: "New roles matching your preferences",
        description: "Talent-network mail. Entirely optional and separate from your applications.",
        modes: ["immediate", "digest", "off"],
        defaultMode: "off",
        channels: ["email"],
        optionalNetworkMail: true,
    },
];
export const CANDIDATE_PREF_KEYS = CANDIDATE_PREF_EVENTS.map((e) => e.key);
export function specFor(key) {
    const spec = CANDIDATE_PREF_EVENTS.find((e) => e.key === key);
    if (!spec)
        throw new Error(`Unknown candidate notification preference: ${key}`);
    return spec;
}
export function defaultCandidatePrefs() {
    return CANDIDATE_PREF_EVENTS.reduce((acc, spec) => {
        acc[spec.key] = spec.defaultMode;
        return acc;
    }, {});
}
export function defaultCandidateSms() {
    return CANDIDATE_PREF_EVENTS.reduce((acc, spec) => {
        acc[spec.key] = false;
        return acc;
    }, {});
}
export function isModeAllowed(key, mode) {
    return specFor(key).modes.includes(mode);
}
export function supportsSms(key) {
    return specFor(key).channels.includes("sms");
}
export function modeLabel(mode) {
    if (mode === "immediate")
        return "As it happens";
    if (mode === "digest")
        return "Daily digest";
    return "Off";
}
/** The state, as text, for a preference row. */
export function rowStateLine(key, mode, sms) {
    const base = mode === "off" ? "Email off" : `Email · ${modeLabel(mode)}`;
    return sms && supportsSms(key) ? `${base} · SMS on` : base;
}
/**
 * Reads whatever is stored in `consent` into a complete, valid set. Unknown or
 * disallowed values fall back to the shipped default, so a locked event can
 * never end up "off" through stale or hand-edited data.
 */
export function normalizeCandidatePrefs(consent) {
    const prefs = defaultCandidatePrefs();
    const sms = defaultCandidateSms();
    const stored = consent?.["notify"];
    const notify = (stored && typeof stored === "object" ? stored : {});
    const smsStored = notify["sms"];
    const smsMap = (smsStored && typeof smsStored === "object" ? smsStored : {});
    for (const spec of CANDIDATE_PREF_EVENTS) {
        const value = notify[spec.key];
        if (typeof value === "string" && isModeAllowed(spec.key, value)) {
            prefs[spec.key] = value;
        }
        sms[spec.key] = supportsSms(spec.key) && smsMap[spec.key] === true;
    }
    // Legacy single email switch: honour it as "off" for the optional events only
    // — it must never silence a deadline-bearing notice.
    if (consent?.["notifications_email"] === false) {
        for (const spec of CANDIDATE_PREF_EVENTS) {
            if (!spec.lockedReason)
                prefs[spec.key] = "off";
        }
    }
    return { prefs, sms };
}
/** True only when a verified mobile number is on file. */
export function hasVerifiedPhone(profile) {
    if (!profile?.phone || profile.phone.trim().length < 6)
        return false;
    const verifiedAt = profile.consent?.["phone_verified_at"];
    return typeof verifiedAt === "string" && verifiedAt.trim().length > 0;
}
export const SMS_UNAVAILABLE_REASON = "Add and verify a mobile number to turn on SMS. We never text an unverified number.";
/**
 * Which candidate preference governs an event type. Events with no entry are
 * essential transactional notices and are never preference-gated.
 */
export const CANDIDATE_EVENT_PREFERENCE = {
    application_received: "application_received",
    candidate_stage_changed: "status_changed",
    candidate_published: "status_changed",
    client_shortlisted: "status_changed",
    client_declined: "status_changed",
    candidate_hired: "status_changed",
    position_closed: "status_changed",
    position_filled: "status_changed",
    interview_requested: "interview_update",
    interview_scheduled: "interview_update",
    interview_rescheduled: "interview_update",
    interview_cancelled: "interview_update",
    clarification_requested: "document_requested",
    document_added: "document_requested",
    message_sent: "team_message",
};

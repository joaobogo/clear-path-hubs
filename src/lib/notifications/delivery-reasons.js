/**
 * Human sentences for delivery outcomes. Pure and client-safe.
 *
 * Delivery rows used to render raw enum codes (`message_sent`,
 * `recipient_suppressed`) and truncated provider JSON as their visible copy.
 * A reader cannot act on that. The raw payload stays available behind
 * "Copy payload"; the row itself says what happened in one sentence.
 *
 * This module is also the single place that decides whether an outcome counts
 * as a real delivery failure, so /admin and /status can never disagree.
 */
const REASONS = {
    recipient_suppressed: {
        label: "Recipient blocked",
        sentence: "Blocked before sending (suppression list or recipient preference).",
        kind: "blocked",
        countsAsFailure: true,
    },
    complaint_not_liftable: {
        label: "Marked as spam",
        sentence: "The recipient reported an earlier email as spam, so this address is permanently blocked.",
        kind: "blocked",
        countsAsFailure: true,
    },
    undeliverable_domain: {
        label: "Domain cannot receive mail",
        sentence: "The recipient's domain cannot receive email, so nothing was sent.",
        kind: "blocked",
        countsAsFailure: true,
    },
    unreachable_mx: {
        label: "Mail server refused",
        sentence: "The recipient's mail server refused the connection, so nothing was sent.",
        kind: "blocked",
        countsAsFailure: true,
    },
    no_recipient_address: {
        label: "No address on file",
        sentence: "No email address is on file for this person, so the email could not be sent.",
        kind: "failed",
        countsAsFailure: true,
    },
    provider_exception: {
        label: "Send failed",
        sentence: "The send failed after repeated attempts. Nothing reached the recipient.",
        kind: "failed",
        countsAsFailure: true,
    },
    rate_limited: {
        label: "Rate limited",
        sentence: "Sending was throttled, so this email has not gone out yet.",
        kind: "failed",
        countsAsFailure: true,
    },
    lead_alert_email_failed: {
        label: "Internal alert failed",
        sentence: "The internal lead alert email did not go out, so no one was notified by email.",
        kind: "failed",
        countsAsFailure: true,
    },
    lead_alert_teams_failed: {
        label: "Teams alert failed",
        sentence: "The internal lead alert did not reach the Teams channel.",
        kind: "failed",
        countsAsFailure: true,
    },
    preference_off: {
        label: "Email turned off",
        sentence: "The recipient turned off email for this event. The in-app notification was still delivered.",
        kind: "held",
        countsAsFailure: false,
    },
    deferred_to_daily_digest: {
        label: "Held for digest",
        sentence: "The recipient chose the daily digest, so this is held for the next one.",
        kind: "held",
        countsAsFailure: false,
    },
    sandboxed_test_recipient: {
        label: "Test workspace — not sent",
        sentence: "This is a test or demo workspace, so the email was recorded instead of sent to a real inbox.",
        kind: "held",
        countsAsFailure: false,
    },
    email_not_configured: {
        label: "Email not configured",
        sentence: "No verified sender domain is configured, so no email was sent. The in-app notification was still delivered.",
        kind: "held",
        countsAsFailure: false,
    },
    email_credentials_missing: {
        label: "Email not configured",
        sentence: "Email sending is not fully configured, so no email was sent. The in-app notification was still delivered.",
        kind: "held",
        countsAsFailure: false,
    },
};
const BY_STATUS = {
    bounced: {
        label: "Bounced",
        sentence: "The address rejected the email, so retrying the same address will fail again.",
        kind: "blocked",
        countsAsFailure: true,
    },
    complained: {
        label: "Marked as spam",
        sentence: "The recipient reported the email as spam, so this address is blocked.",
        kind: "blocked",
        countsAsFailure: true,
    },
    failed: {
        label: "Not delivered",
        sentence: "The email did not reach the recipient. Nothing is lost — it can be re-sent.",
        kind: "failed",
        countsAsFailure: true,
    },
    suppressed: {
        label: "Recipient blocked",
        sentence: "Blocked before sending (suppression list or recipient preference).",
        kind: "blocked",
        countsAsFailure: true,
    },
};
/** Human reason for one delivery row. Falls back to the status, never to a code. */
export function deliveryReason(code, status) {
    const byCode = code ? REASONS[code.toLowerCase()] : undefined;
    if (byCode)
        return byCode;
    const byStatus = status ? BY_STATUS[status.toLowerCase()] : undefined;
    if (byStatus)
        return byStatus;
    return {
        label: "Unclear outcome",
        sentence: "We could not confirm this email reached the recipient. Treat it as undelivered until it is re-sent.",
        kind: "unknown",
        countsAsFailure: true,
    };
}
/** Did someone fail to be informed? The only definition used anywhere. */
export function countsAsDeliveryFailure(status, code) {
    const s = (status ?? "").toLowerCase();
    if (["delivered", "provider_accepted", "sent"].includes(s))
        return false;
    if (["queued", "pending", "sending", "created"].includes(s))
        return false;
    return deliveryReason(code, s).countsAsFailure;
}
/** A delivery whose outcome is final — the denominator for a status verdict. */
export function isSettledDelivery(status, code) {
    const s = (status ?? "").toLowerCase();
    if (["delivered", "provider_accepted", "sent"].includes(s))
        return true;
    if (["queued", "pending", "sending", "created"].includes(s))
        return false;
    // Held-on-purpose outcomes (digest, preference off, test workspace) are not
    // deliveries that were attempted, so they belong in neither side of the ratio.
    return deliveryReason(code, s).kind !== "held";
}

// Email channel dispatch for TaaSFlow notifications.
// SERVER ONLY — never import from browser code.
//
// Design rules:
//  * One notification -> at most one email row per recipient. The unique
//    idempotency key on notification_deliveries makes retries safe.
//  * Essential (security/transactional) events ignore preferences and
//    unsubscribe state. Everything else respects them.
//  * No email body ever contains protected candidate contact details.
//  * When no email provider is configured we record the attempt honestly as
//    `suppressed / email_not_configured` instead of pretending to send.

import type { EventType } from "./events";
import { EVENT_PREFERENCE, normalizePreferences } from "./client-notification-prefs";
import {
  CANDIDATE_EVENT_PREFERENCE,
  normalizeCandidatePrefs,
} from "./candidate/notification-prefs";
import { isSuppressed } from "./notification-suppression.server";


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

/** Events that must always be delivered regardless of preferences. */
export const ESSENTIAL_EVENTS: ReadonlySet<EventType> = new Set<EventType>([
  "member_invited",
  "member_removed",
  "contact_released",
  "contact_revoked",
  "cv_parse_failed",
  "interview_scheduled",
  "interview_cancelled",
  "clarification_requested",
]);

// Per-event delivery choices live in src/lib/client-notification-prefs.ts. Each
// client event maps to one preference whose mode decides immediate / digest /
// off. Essential transactional notices above ignore preferences entirely.


/** Verified Lovable sender subdomain (NS-delegated). Overridable via env. */
const SENDER_DOMAIN = "notify.taasflow.com";
/** Domain shown in the From: header (cosmetic). */
const FROM_DOMAIN = "taasflow.com";

export type EmailConfig = {
  configured: boolean;
  senderDomain: string | null;
  reason: string | null;
};

/**
 * Reads real configuration only. There is no fake/mock sender: if the project
 * has no verified sender domain, email is honestly reported as unconfigured.
 */
export function readEmailConfig(): EmailConfig {
  const domain =
    process.env.SENDER_DOMAIN ?? process.env.LOVABLE_EMAIL_DOMAIN ?? SENDER_DOMAIN;
  const apiKey = process.env.LOVABLE_API_KEY ?? null;
  if (!domain) {
    return { configured: false, senderDomain: null, reason: "email_not_configured" };
  }
  if (!apiKey) {
    return { configured: false, senderDomain: domain, reason: "email_credentials_missing" };
  }
  return { configured: true, senderDomain: domain, reason: null };
}

async function recipientEmail(admin: Admin, userId: string): Promise<string | null> {
  const { data } = await admin
    .from("profiles")
    .select("email")
    .eq("auth_user_id", userId)
    .maybeSingle();
  return (data?.email as string | undefined) ?? null;
}

export type EmailDecision = "send" | "digest" | "off";

/**
 * Resolves the recipient's per-event delivery choice.
 *  - "send"   email now
 *  - "digest" hold it for the daily digest (no immediate email)
 *  - "off"    no email at all
 * Essential transactional notices always send.
 */
export async function emailDecision(
  admin: Admin,
  args: { userId: string; orgId: string | null; event: EventType; audience?: string | null },
): Promise<EmailDecision> {
  // Candidates keep their own per-event choices on their profile. They are
  // resolved first: a candidate is never governed by a workspace row, and a
  // deadline-bearing notice can only be deferred, never dropped.
  if (args.audience === "candidate") {
    const key = CANDIDATE_EVENT_PREFERENCE[args.event];
    if (!key) return "send";
    const { data: profile } = await admin
      .from("candidate_profiles")
      .select("consent")
      .eq("user_id", args.userId)
      .maybeSingle();
    const { prefs } = normalizeCandidatePrefs(
      (profile?.consent ?? null) as Record<string, unknown> | null,
    );
    const mode = prefs[key];
    if (mode === "digest") return "digest";
    if (mode === "off") return "off";
    return "send";
  }
  if (ESSENTIAL_EVENTS.has(args.event)) return "send";
  const key = EVENT_PREFERENCE[args.event];
  if (!key || !args.orgId) return "send";
  const { data } = await admin
    .from("client_notification_preferences")
    .select("*")
    .eq("user_id", args.userId)
    .eq("organization_id", args.orgId)
    .maybeSingle();
  const prefs = normalizePreferences((data ?? null) as Record<string, unknown> | null);
  const mode = prefs[key];
  if (mode === "daily") return "digest";
  if (mode === "off") return "off";
  return "send";
}

const APP_ORIGIN =
  process.env.PUBLIC_APP_ORIGIN ?? "https://taasflow.com";

export function absoluteLink(path: string | null | undefined): string {
  if (!path) return APP_ORIGIN;
  if (/^https?:\/\//.test(path)) return path;
  return `${APP_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Minimal, brand-consistent HTML. Deliberately plain so it renders identically
 * on mobile and desktop clients and contains no placeholder variables.
 */
export function renderEmail(args: {
  title: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
  context?: string | null;
}): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(args.title)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
  <div style="font-size:14px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">TaaSFlow</div>
  <h1 style="font-size:22px;line-height:1.3;margin:16px 0 8px">${esc(args.title)}</h1>
  <p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#374151">${esc(args.body)}</p>
  ${args.context ? `<p style="font-size:14px;line-height:1.6;margin:0 0 20px;color:#6b7280">${esc(args.context)}</p>` : ""}
  <p style="margin:24px 0">
    <a href="${esc(args.actionUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:600">${esc(args.actionLabel)}</a>
  </p>
  <p style="font-size:13px;line-height:1.6;color:#6b7280;margin:0">
    Need help? Reply to this email and our team will pick it up.
  </p>
</div>
</body></html>`;
}

export type EmailAttempt = {
  notificationId: string;
  status: "delivered" | "provider_accepted" | "failed" | "suppressed";
  errorCode: string | null;
  errorMessage: string | null;
};

/**
 * Queue + attempt one email per notification. Safe to call repeatedly:
 * the delivery row is keyed by notification id + channel.
 */
export async function dispatchEmails(
  admin: Admin,
  notifications: Array<{
    id: string;
    recipient_user_id: string;
    organization_id: string | null;
    event_type: EventType;
    title: string;
    body: string | null;
    link_path: string | null;
    audience?: string | null;
  }>,
): Promise<EmailAttempt[]> {
  const cfg = readEmailConfig();
  const results: EmailAttempt[] = [];

  for (const n of notifications) {
    const decision = await emailDecision(admin, {
      userId: n.recipient_user_id,
      orgId: n.organization_id,
      event: n.event_type,
      audience: n.audience ?? null,
    });
    let status: EmailAttempt["status"] = "suppressed";
    let errorCode: string | null = null;
    let errorMessage: string | null = null;
    let address: string | null = null;

    if (decision !== "send") {
      errorCode = decision === "digest" ? "deferred_to_daily_digest" : "preference_off";
      errorMessage =
        decision === "digest"
          ? "The recipient chose the daily digest for this event, so it is held for the next digest instead of sending now."
          : "The recipient turned off email for this event. The in-app notification was still delivered.";
    } else {
      address = await recipientEmail(admin, n.recipient_user_id);
      const blocked = address ? await isSuppressed(admin, address) : false;
      const sandboxed = await isSandboxRecipient(admin, {
        orgId: n.organization_id,
        address,
      });
      if (!address) {
        status = "failed";
        errorCode = "no_recipient_address";
        errorMessage = "No email address on file for this user.";
      } else if (sandboxed) {
        // QA and demo traffic must never touch a real inbox: bounces from
        // fabricated addresses land the whole sender on the provider's global
        // suppression list and take real client email down with them.
        status = "suppressed";
        errorCode = "sandboxed_test_recipient";
        errorMessage =
          "This is a test or demo workspace, so the email was recorded instead of sent to a real inbox.";
      } else if (blocked) {
        status = "suppressed";
        errorCode = "recipient_suppressed";
        errorMessage =
          "This address is on the suppression list, so no email was sent. The in-app notification was still delivered.";
      } else if (!cfg.configured) {

        status = "suppressed";
        errorCode = cfg.reason;
        errorMessage =
          "No verified sender domain is configured, so no email was sent. The in-app notification was still delivered.";
      } else {
        try {
          const res = await sendWithRetries({
            to: address,
            subject: n.title,
            html: renderEmail({
              title: n.title,
              body: n.body ?? n.title,
              actionLabel: "Open in TaaSFlow",
              actionUrl: absoluteLink(n.link_path),
            }),
            idempotencyKey: `${n.id}:email`,
            senderDomain: cfg.senderDomain!,
          });
          if (res.ok) {
            status = "provider_accepted";
          } else {
            // A recipient the provider refuses to email is blocked, not a
            // failure of ours: reporting it as "we could not send" invites a
            // pointless retry and reads as a platform fault.
            status = isBlockedRecipientCode(res.code) ? "suppressed" : "failed";
            errorCode = res.code;
            errorMessage = res.message;
          }
        } catch (e) {
          status = "failed";
          errorCode = "provider_exception";
          errorMessage = e instanceof Error ? e.message : String(e);
        }
      }
    }

    await admin.from("notification_deliveries").upsert(
      {
        notification_id: n.id,
        channel: "email",
        status,
        error_code: errorCode,
        error_message: errorMessage,
        recipient_address: address,
        idempotency_key: `${n.id}:email`,
        last_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "notification_id,channel" },
    );

    results.push({ notificationId: n.id, status, errorCode, errorMessage });
  }
  return results;
}

async function sendViaProvider(args: {
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
  senderDomain: string;
}): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return { ok: false, code: "email_credentials_missing", message: "LOVABLE_API_KEY is not configured." };
  }
  const { EmailAPIError, sendLovableEmail } = await import("@lovable.dev/email-js");
  try {
    await sendLovableEmail(
      {
        to: args.to,
        from: `TaaSFlow <notifications@${FROM_DOMAIN}>`,
        sender_domain: args.senderDomain,
        subject: args.subject,
        html: args.html,
        text: args.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        purpose: "transactional",
        idempotency_key: args.idempotencyKey,
      },
      { apiKey, sendUrl: process.env.LOVABLE_SEND_URL },
    );
    return { ok: true };
  } catch (e) {
    if (e instanceof EmailAPIError) {
      return { ok: false, code: e.code ?? `provider_${e.status}`, message: e.message.slice(0, 500) };
    }
    return {
      ok: false,
      code: "provider_exception",
      message: e instanceof Error ? e.message.slice(0, 500) : "Provider rejected the message.",
    };
  }
}

/** Provider verdicts that mean "this recipient is blocked", not "we failed". */
export function isBlockedRecipientCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return [
    "recipient_suppressed",
    "complaint_not_liftable",
    "undeliverable_domain",
    "unreachable_mx",
  ].includes(code);
}

/** Codes worth another attempt: throttling, provider hiccups, network blips. */
function isTransientCode(code: string | null | undefined): boolean {
  if (!code) return false;
  if (code === "provider_exception" || code === "rate_limited") return true;
  const m = /^provider_(\d{3})$/.exec(code);
  if (!m) return false;
  const status = Number(m[1]);
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Send with bounded retries. A transient provider error used to surface to the
 * user as "Email not delivered" on the first blip; now we only report failure
 * once the retries are exhausted.
 */
async function sendWithRetries(
  args: Parameters<typeof sendViaProvider>[0],
  attempts = 3,
): Promise<Awaited<ReturnType<typeof sendViaProvider>>> {
  let last: Awaited<ReturnType<typeof sendViaProvider>> = {
    ok: false,
    code: "provider_exception",
    message: "No attempt was made.",
  };
  for (let i = 0; i < attempts; i += 1) {
    last = await sendViaProvider(args);
    if (last.ok || !isTransientCode(last.code)) return last;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  return last;
}



/** Re-attempt a single failed delivery. Idempotent by notification+channel. */
export async function retryDelivery(admin: Admin, deliveryId: string) {
  const { data: delivery } = await admin
    .from("notification_deliveries")
    .select("id, notification_id, channel, attempt_count, status")
    .eq("id", deliveryId)
    .maybeSingle();
  if (!delivery) throw new Error("delivery_not_found");
  if (delivery.channel !== "email") throw new Error("channel_not_retryable");
  // Never re-send something that already left successfully.
  if (delivery.status === "delivered" || delivery.status === "provider_accepted") {
    return {
      notificationId: delivery.notification_id as string,
      status: delivery.status as "delivered" | "provider_accepted",
      errorCode: "already_sent",
      errorMessage: "This delivery already succeeded, so nothing was re-sent.",
    };
  }


  const { data: n } = await admin
    .from("notifications")
    .select("id, recipient_user_id, organization_id, event_type, title, body, link_path")
    .eq("id", delivery.notification_id)
    .maybeSingle();
  if (!n) throw new Error("notification_not_found");

  const [result] = await dispatchEmails(admin, [n]);
  await admin
    .from("notification_deliveries")
    .update({ attempt_count: (delivery.attempt_count ?? 1) + 1 })
    .eq("id", deliveryId);
  return result;
}

// ---------------------------------------------------------------------------
// Intake welcome email
// ---------------------------------------------------------------------------

/**
 * Branded welcome email sent to the person who submitted an employer intake.
 * Confirms the workspace + requisition were created and links to the dashboard.
 * Non-critical: returns a result instead of throwing.
 */
export async function sendIntakeWelcomeEmail(args: {
  to: string;
  firstName: string;
  companyName: string;
  roleTitle: string;
  reference: string;
  requisitionPending: boolean;
}): Promise<{ ok: boolean; reason?: string }> {
  const cfg = readEmailConfig();
  if (!cfg.configured) return { ok: false, reason: cfg.reason ?? "email_not_configured" };

  const greeting = args.firstName ? `Hi ${args.firstName},` : "Hi,";
  const html = renderIntakeWelcomeEmail({ ...args, greeting });
  try {
    const res = await sendViaProvider({
      to: args.to,
      subject: `Your ${args.roleTitle} search is being set up — TaaSFlow`,
      html,
      idempotencyKey: `intake:${args.reference}:welcome`,
      senderDomain: cfg.senderDomain!,
    });
    return res.ok ? { ok: true } : { ok: false, reason: res.code };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "provider_exception" };
  }
}

function renderIntakeWelcomeEmail(args: {
  greeting: string;
  companyName: string;
  roleTitle: string;
  reference: string;
  requisitionPending: boolean;
}): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const loginUrl = absoluteLink("/login");
  const steps: Array<[string, string]> = [
    ["Workspace created", "Your TaaSFlow workspace and admin access are ready."],
    [
      args.requisitionPending ? "Requisition being prepared" : "Requisition created",
      `We're structuring ${esc(args.roleTitle)} into a scored requisition — must-haves, dealbreakers and screening criteria.`,
    ],
    [
      "Evaluation model in progress",
      "Our team is calibrating the scoring rubric for this role. First ranked candidates follow in days.",
    ],
  ];

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Your TaaSFlow workspace is being set up</title></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f1b2d">
<div style="max-width:600px;margin:0 auto;padding:32px 20px">
  <div style="background:#ffffff;border:1px solid #e5e9f0;border-radius:14px;overflow:hidden">
    <div style="background:#0f1b2d;padding:20px 28px">
      <div style="font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#ffffff">TaaSFlow</div>
      <div style="font-size:12px;letter-spacing:.04em;color:#9fb3c8;margin-top:4px">ATS + recruiting + outreach, one subscription</div>
    </div>
    <div style="padding:28px">
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 10px">We're setting up your ${esc(args.roleTitle)} search</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 18px;color:#3a4a60">
        ${esc(args.greeting)} thanks for your intake for <strong>${esc(args.companyName)}</strong>.
        The system is creating your workspace and role, and our team is building the evaluation model now.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 22px">
        ${steps
          .map(
            ([label, copy], i) => `<tr>
          <td valign="top" style="width:28px;padding:8px 0;font-size:13px;font-weight:700;color:#1f7a8c">${i + 1}</td>
          <td style="padding:8px 0">
            <div style="font-size:15px;font-weight:600;color:#0f1b2d">${esc(label)}</div>
            <div style="font-size:14px;line-height:1.55;color:#5a6b80">${copy}</div>
          </td>
        </tr>`,
          )
          .join("")}
      </table>
      <p style="margin:0 0 22px">
        <a href="${esc(loginUrl)}" style="display:inline-block;background:#1f7a8c;color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:9px;font-size:15px;font-weight:600">Log in to your dashboard</a>
      </p>
      <p style="font-size:13px;line-height:1.6;color:#5a6b80;margin:0 0 6px">
        Sign in with your work email. If you didn't set a password, use "Forgot password" on the login page to create one.
      </p>
      <p style="font-size:13px;line-height:1.6;color:#8496a8;margin:14px 0 0">
        Reference ${esc(args.reference.slice(0, 8))} · A TaaSFlow reviewer confirms scope within one business day.
      </p>
    </div>
  </div>
  <p style="font-size:12px;color:#8496a8;text-align:center;margin:16px 0 0">TaaSFlow · Subscription recruiting</p>
</div>
</body></html>`;
}

/* ----------------------------------------------- native booking lifecycle -- */

/**
 * Confirmation / reschedule / cancellation email for a natively booked sales
 * call. Non-critical: returns a result instead of throwing, so the visitor's
 * booking is never lost to an email problem.
 */
export async function sendBookingLifecycleEmail(args: {
  to: string;
  firstName: string;
  kind: "scheduled" | "rescheduled" | "cancelled" | "reminder";
  when: string;
  sessionId: string;
  joinUrl: string | null;
  hostName: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const cfg = readEmailConfig();
  if (!cfg.configured) return { ok: false, reason: cfg.reason ?? "email_not_configured" };

  const greeting = args.firstName ? `Hi ${args.firstName},` : "Hi,";
  const subject =
    args.kind === "cancelled"
      ? "Your TaaSFlow call is cancelled"
      : args.kind === "rescheduled"
        ? `Your TaaSFlow call moved to ${args.when}`
        : args.kind === "reminder"
          ? `Reminder: your TaaSFlow call is coming up — ${args.when}`
          : `Your TaaSFlow call is confirmed — ${args.when}`;
  const body =
    args.kind === "cancelled"
      ? `${greeting} we've cancelled the call. You can pick a new time whenever it suits you.`
      : args.kind === "reminder"
        ? `${greeting} a quick reminder that you're speaking with ${args.hostName} at ${args.when}.`
        : `${greeting} you're booked with ${args.hostName} for ${args.when}.`;
  const context =
    args.kind === "cancelled"
      ? null
      : args.joinUrl
        ? `Join here at the time: ${args.joinUrl}`
        : "We'll send the meeting link before the call. You can reschedule or cancel from your booking page.";

  const html = renderEmail({
    title: subject,
    body,
    context,
    actionLabel: args.kind === "cancelled" ? "Pick a new time" : "Manage this booking",
    actionUrl: absoluteLink(`/book?session=${args.sessionId}`),
  });

  try {
    const res = await sendViaProvider({
      to: args.to,
      subject,
      html,
      idempotencyKey: `booking:${args.sessionId}:${args.kind}:${args.when}`,
      senderDomain: cfg.senderDomain!,
    });
    return res.ok ? { ok: true } : { ok: false, reason: res.code };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "provider_exception" };
  }
}

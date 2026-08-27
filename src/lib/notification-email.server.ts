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
import { EmailAPIError } from "@lovable.dev/email-js";
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

/** Domains that only ever exist in QA fixtures — never real mailboxes. */
const SANDBOX_ADDRESS_PATTERN = /(\.test|\.invalid|\.example|example\.com|localhost)$/i;

const sandboxOrgCache = new Map<string, boolean>();

/**
 * True when this recipient belongs to test/demo traffic and must not be emailed
 * for real. Sends to fabricated addresses hard-bounce, and a hard bounce puts
 * the address on the provider's global suppression list — which is what took
 * real notification email down.
 */
export async function isSandboxRecipient(
  admin: Admin,
  args: { orgId: string | null; address: string | null },
): Promise<boolean> {
  const domain = (args.address ?? "").split("@")[1] ?? "";
  if (domain && SANDBOX_ADDRESS_PATTERN.test(domain)) return true;
  if (!args.orgId) return false;
  const cached = sandboxOrgCache.get(args.orgId);
  if (cached !== undefined) return cached;
  const { data } = await admin
    .from("organizations")
    .select("is_test_record, is_demo")
    .eq("id", args.orgId)
    .maybeSingle();
  // Demo workspaces carry fictional people. Their addresses must never receive
  // real mail, for the same bounce-reputation reason as test workspaces.
  const isTest = data?.is_test_record === true || data?.is_demo === true;
  sandboxOrgCache.set(args.orgId, isTest);
  return isTest;

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
 * Notification email HTML.
 *
 * Every notification that reaches an inbox — a new message from a client, a
 * decision waiting, a shortlist delivered — used to arrive as a grey wordmark
 * and a black button, while the transactional templates next to it in the same
 * inbox carried the navy header and ocean button from
 * `src/lib/email-templates/brand.tsx`. Two different products, from the same
 * sender, on the same day.
 *
 * The palette below mirrors that file exactly. It is inlined rather than
 * imported because email clients resolve neither CSS variables nor oklch(), and
 * because this module is server-only and must not pull in React Email to render
 * one card. If the brand palette moves, move it here too.
 */
export function renderEmail(args: {
  title: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
  context?: string | null;
  /** Overrides the default "reply to this email" line. */
  footerNote?: string | null;
}): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const font =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  // Mirrors palette in src/lib/email-templates/brand.tsx.
  const navy = "#1e2a4a";
  const ocean = "#2563eb";
  const ink = "#141a28";
  const body = "#55606f";
  const muted = "#8a93a3";
  const border = "#e3e8ef";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(args.title)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:${font};color:${ink}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(args.body)}</div>
<div style="max-width:560px;margin:0 auto;padding:24px 0 32px">
  <div style="background:${navy};padding:22px 28px;border-radius:12px 12px 0 0">
    <p style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:-0.01em;margin:0">TaaSFlow</p>
    <p style="color:#b9c6e0;font-size:12px;margin:4px 0 0">Hiring intelligence</p>
  </div>
  <div style="border:1px solid ${border};border-top:none;border-radius:0 0 12px 12px;padding:28px">
    <h1 style="font-size:21px;font-weight:700;color:${ink};margin:0 0 14px;line-height:1.3">${esc(args.title)}</h1>
    <p style="font-size:15px;color:${body};line-height:1.6;margin:0 0 20px">${esc(args.body)}</p>
    ${args.context ? `<p style="font-size:14px;color:${muted};line-height:1.6;margin:0 0 20px">${esc(args.context)}</p>` : ""}
    <p style="margin:0 0 24px">
      <a href="${esc(args.actionUrl)}" style="background:${ocean};color:#ffffff;font-size:15px;font-weight:600;border-radius:8px;padding:14px 24px;text-decoration:none;display:inline-block">${esc(args.actionLabel)}</a>
    </p>
    <p style="font-size:13px;color:${muted};line-height:1.6;margin:0;border-top:1px solid ${border};padding-top:16px">
      ${esc(args.footerNote ?? "Need help? Reply to this email and our team will pick it up.")}
    </p>
  </div>
</div>
</body></html>`;
}

/**
 * What the button says. "Open in TaaSFlow" on a message notice makes the reader
 * work out why they are being sent anywhere; naming the thing waiting for them
 * is the difference between a click and an ignored email.
 */
export function emailActionLabel(event: EventType): string {
  switch (event) {
    case "message_sent":
      return "Read the message";
    case "approval_needed":
      return "Review and decide";
    case "candidate_published":
    case "shortlist_ready":
      return "See the shortlist";
    case "interview_requested":
    case "interview_scheduled":
    case "interview_rescheduled":
      return "See the interview";
    case "clarification_requested":
    case "client_information_requested":
    case "role_information_missing":
      return "Answer the question";
    default:
      return "Open in TaaSFlow";
  }
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
              actionLabel: emailActionLabel(n.event_type),
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
            status = isBlockedRecipientCode(res.code) || isHeldEmailCode(res.code) ? "suppressed" : "failed";
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
  const { sendLovableEmail } = await import("@lovable.dev/email-js");
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

export function isHeldEmailCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return [
    "email_not_configured",
    "email_credentials_missing",
    "no_matching_sender",
    "lovable_api_key_not_registered",
    "domain_not_verified",
    "emails_disabled",
    "sandboxed_test_recipient",
    "preference_off",
    "deferred_to_daily_digest",
  ].includes(code);
}

export function classifyEmailError(error: unknown): { code: string; message: string } {
  if (error instanceof EmailAPIError) {
    return {
      code: error.code ?? `provider_${error.status}`,
      message: error.message.slice(0, 500),
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes("lovable_api_key") || lower.includes("api key")) {
    return { code: "email_credentials_missing", message: message.slice(0, 500) };
  }
  if (lower.includes("no_matching_sender")) {
    return { code: "no_matching_sender", message: message.slice(0, 500) };
  }
  return { code: "provider_exception", message: message.slice(0, 500) };
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
      "Our team is calibrating how we score this role. First ranked candidates follow in days.",
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

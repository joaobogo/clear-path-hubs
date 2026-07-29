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

/** Preference column on client_notification_preferences, when one applies. */
const PREFERENCE_COLUMN: Partial<Record<EventType, string>> = {
  candidate_published: "candidate_delivered",
  interview_requested: "interview_request",
  message_sent: "new_message",
  client_feedback_submitted: "new_message",
  candidate_hired: "hire_update",
};

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
  const domain = process.env.SENDER_DOMAIN ?? process.env.LOVABLE_EMAIL_DOMAIN ?? null;
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

async function emailAllowed(
  admin: Admin,
  args: { userId: string; orgId: string | null; event: EventType },
): Promise<{ allowed: boolean; reason?: string }> {
  if (ESSENTIAL_EVENTS.has(args.event)) return { allowed: true };
  if (!args.orgId) return { allowed: true };
  const { data } = await admin
    .from("client_notification_preferences")
    .select("*")
    .eq("user_id", args.userId)
    .eq("organization_id", args.orgId)
    .maybeSingle();
  if (!data) return { allowed: true };
  if (data.email_enabled === false) return { allowed: false, reason: "unsubscribed" };
  const col = PREFERENCE_COLUMN[args.event];
  if (col && data[col] === false) return { allowed: false, reason: "preference_off" };
  return { allowed: true };
}

const APP_ORIGIN =
  process.env.PUBLIC_APP_ORIGIN ?? "https://clear-path-hubs.lovable.app";

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
  }>,
): Promise<EmailAttempt[]> {
  const cfg = readEmailConfig();
  const results: EmailAttempt[] = [];

  for (const n of notifications) {
    const gate = await emailAllowed(admin, {
      userId: n.recipient_user_id,
      orgId: n.organization_id,
      event: n.event_type,
    });
    let status: EmailAttempt["status"] = "suppressed";
    let errorCode: string | null = null;
    let errorMessage: string | null = null;
    let address: string | null = null;

    if (!gate.allowed) {
      errorCode = gate.reason ?? "suppressed";
      errorMessage = "Recipient preference or unsubscribe applies to this email.";
    } else {
      address = await recipientEmail(admin, n.recipient_user_id);
      if (!address) {
        status = "failed";
        errorCode = "no_recipient_address";
        errorMessage = "No email address on file for this user.";
      } else if (!cfg.configured) {
        status = "suppressed";
        errorCode = cfg.reason;
        errorMessage =
          "No verified sender domain is configured, so no email was sent. The in-app notification was still delivered.";
      } else {
        try {
          const res = await sendViaProvider({
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
          status = res.ok ? "provider_accepted" : "failed";
          errorCode = res.ok ? null : res.code;
          errorMessage = res.ok ? null : res.message;
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
  const res = await fetch("https://api.lovable.dev/v1/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
      "Idempotency-Key": args.idempotencyKey,
    },
    body: JSON.stringify({
      from: `TaaSFlow <notifications@${args.senderDomain}>`,
      to: [args.to],
      subject: args.subject,
      html: args.html,
    }),
  });
  if (res.ok) return { ok: true };
  const text = await res.text().catch(() => "");
  return {
    ok: false,
    code: `provider_${res.status}`,
    message: text.slice(0, 500) || "Provider rejected the message.",
  };
}

/** Re-attempt a single failed delivery. Idempotent by notification+channel. */
export async function retryDelivery(admin: Admin, deliveryId: string) {
  const { data: delivery } = await admin
    .from("notification_deliveries")
    .select("id, notification_id, channel, attempt_count")
    .eq("id", deliveryId)
    .maybeSingle();
  if (!delivery) throw new Error("delivery_not_found");
  if (delivery.channel !== "email") throw new Error("channel_not_retryable");

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
      "Our team is calibrating the scoring rubric for this role. First ranked candidates follow within 7–14 days.",
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

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

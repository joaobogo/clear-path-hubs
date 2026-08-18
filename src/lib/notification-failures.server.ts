/**
 * Delivery-failure inspection for /admin/notifications. SERVER ONLY.
 *
 * A "failure" is a delivery whose final attempt did not succeed. Two ledgers
 * feed this view:
 *   * notification_deliveries — client/candidate notifications (email channel).
 *   * lead_notifications      — internal lead alerts (email + Teams channels).
 *
 * Retries go back through the existing send path with the original payload;
 * nothing here talks to a provider directly.
 */

import { deliveryReason } from "./notifications/delivery-reasons";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

const WINDOW_DAYS = 7;

/** Events where a late re-send is misleading rather than helpful. */
const TIME_SENSITIVE_EVENTS = new Set<string>([
  "interview_scheduled",
  "interview_cancelled",
  "interview_requested",
  "interview_reminder",
  "clarification_requested",
  "message_sent",
]);

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export type DeliveryFailure = {
  key: string;
  ledger: "notification" | "lead";
  id: string;
  eventType: string;
  /** Human event name for the row; the raw enum stays in the payload. */
  eventLabel: string;
  title: string | null;
  audience: string | null;
  channel: string;
  recipient: string | null;
  /** Raw provider/enum code — payload only, never row copy. */
  reason: string;
  reasonDetail: string | null;
  /** Short human chip. */
  reasonLabel: string;
  /** The human sentence shown in the row. */
  reasonSentence: string;
  /** True when the block can be cleared and the send re-attempted. */
  canUnsuppress: boolean;
  attempts: number;
  firstAttemptAt: string;
  lastAttemptAt: string;
  retryable: boolean;
  retryBlockedReason: string | null;
  staleWarning: boolean;
  relatedPath: string | null;
  payloadJson: string;
};

/** "candidate_ready_for_admin_review" -> "Candidate ready for admin review". */
export function humaniseEventType(raw: string): string {
  if (raw.startsWith("lead:")) {
    return `Lead alert — ${humaniseEventType(raw.slice(5))}`;
  }
  const words = raw.replace(/[_-]+/g, " ").trim();
  if (!words) return "Unknown event";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function since(): string {
  return new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
}

function isStale(eventType: string, lastAttemptAt: string): boolean {
  if (!TIME_SENSITIVE_EVENTS.has(eventType)) return false;
  return Date.now() - new Date(lastAttemptAt).getTime() > STALE_AFTER_MS;
}

/** Bounced / suppressed deliveries must never be retried blindly. */
function notificationRetry(status: string): { retryable: boolean; reason: string | null } {
  if (status === "bounced")
    return { retryable: false, reason: "The address rejected the message — retrying will fail again." };
  if (status === "suppressed")
    return { retryable: false, reason: "Blocked before sending (suppression list or recipient preference)." };
  return { retryable: true, reason: null };
}

export async function loadDeliveryFailures(admin: Admin): Promise<{
  items: DeliveryFailure[];
  suppressions: Array<{ id: string; email: string; reason: string | null; source: string; created_at: string }>;
  windowDays: number;
}> {
  const cutoff = since();

  const [deliveriesRes, leadsRes] = await Promise.all([
    admin
      .from("notification_deliveries")
      .select(
        "id, channel, status, error_code, error_message, attempt_count, created_at, last_attempt_at, updated_at, recipient_address, notification_id, notifications:notification_id(title, audience, event_type, link_path, recipient_user_id)",
      )
      .in("status", ["failed", "bounced", "suppressed"])
      .gte("created_at", cutoff)
      .order("updated_at", { ascending: false })
      .limit(200),
    admin
      .from("lead_notifications")
      .select(
        "id, lead_type, source, source_page, email, full_name, company, owner_email, email_status, email_detail, email_recipients, teams_status, teams_detail, attempts, created_at, last_attempt_at, updated_at, payload, record_table, record_id, organization_id, position_id",
      )
      .or("email_status.eq.failed,teams_status.eq.failed")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (deliveriesRes.error) throw new Error(deliveriesRes.error.message);
  if (leadsRes.error) throw new Error(leadsRes.error.message);

  const rows = (deliveriesRes.data ?? []) as Array<Record<string, unknown>>;

  // Fill in missing recipient addresses from profiles, so staff always see who
  // was supposed to be informed.
  const missing = [
    ...new Set(
      rows
        .filter((r) => !r["recipient_address"])
        .map((r) => (r["notifications"] as { recipient_user_id?: string } | null)?.recipient_user_id)
        .filter((v): v is string => !!v),
    ),
  ];
  const emailByUser = new Map<string, string>();
  if (missing.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("auth_user_id, email")
      .in("auth_user_id", missing);
    for (const p of (profiles ?? []) as Array<{ auth_user_id: string; email: string | null }>) {
      if (p.email) emailByUser.set(p.auth_user_id, p.email);
    }
  }

  const notificationItems: DeliveryFailure[] = rows.map((r) => {
    const n = (r["notifications"] ?? null) as {
      title?: string;
      audience?: string;
      event_type?: string;
      link_path?: string | null;
      recipient_user_id?: string;
    } | null;
    const status = String(r["status"]);
    const eventType = n?.event_type ?? "unknown";
    const lastAttemptAt = String(r["last_attempt_at"] ?? r["updated_at"]);
    const retry = notificationRetry(status);
    const rawCode = (r["error_code"] as string | null) ?? null;
    const human = deliveryReason(rawCode, status);
    return {
      key: `notification:${r["id"]}`,
      ledger: "notification" as const,
      id: String(r["id"]),
      eventType,
      eventLabel: humaniseEventType(eventType),
      title: n?.title ?? null,
      audience: n?.audience ?? null,
      channel: String(r["channel"]),
      recipient:
        (r["recipient_address"] as string | null) ??
        (n?.recipient_user_id ? (emailByUser.get(n.recipient_user_id) ?? null) : null),
      reason: rawCode ?? status,
      reasonDetail: (r["error_message"] as string | null) ?? null,
      reasonLabel: human.label,
      reasonSentence: human.sentence,
      canUnsuppress: human.kind === "blocked" && String(r["channel"]) === "email",
      attempts: Number(r["attempt_count"] ?? 1),
      firstAttemptAt: String(r["created_at"]),
      lastAttemptAt,
      retryable: retry.retryable && String(r["channel"]) === "email",
      retryBlockedReason:
        String(r["channel"]) === "email"
          ? retry.reason
          : "Only email deliveries can be re-attempted from here.",
      staleWarning: isStale(eventType, lastAttemptAt),
      relatedPath: n?.link_path ?? null,
      payloadJson: JSON.stringify({
        notification_id: r["notification_id"],
        event_type: eventType,
        title: n?.title ?? null,
        audience: n?.audience ?? null,
        channel: r["channel"],
        recipient_address: r["recipient_address"] ?? null,
        status,
        error_code: r["error_code"] ?? null,
        error_message: r["error_message"] ?? null,
        link_path: n?.link_path ?? null,
      }, null, 2),
    };
  });

  const leadItems: DeliveryFailure[] = [];
  for (const l of (leadsRes.data ?? []) as Array<Record<string, unknown>>) {
    const payload = (l["payload"] ?? {}) as { link_path?: string };
    const base = {
      id: String(l["id"]),
      ledger: "lead" as const,
      eventType: `lead:${String(l["lead_type"])}`,
      title: [l["full_name"], l["company"]].filter(Boolean).join(" · ") || String(l["lead_type"]),
      audience: "internal",
      attempts: Number(l["attempts"] ?? 0),
      firstAttemptAt: String(l["created_at"]),
      lastAttemptAt: String(l["last_attempt_at"] ?? l["updated_at"] ?? l["created_at"]),
      relatedPath: payload.link_path ?? null,
      payloadJson: JSON.stringify({
        lead_notification_id: l["id"],
        lead_type: l["lead_type"],
        source: l["source"],
        source_page: l["source_page"],
        contact_email: l["email"],
        company: l["company"],
        email_recipients: l["email_recipients"],
        email_status: l["email_status"],
        email_detail: l["email_detail"],
        teams_status: l["teams_status"],
        teams_detail: l["teams_detail"],
        record_table: l["record_table"],
        record_id: l["record_id"],
      }, null, 2),
    };
    if (l["email_status"] === "failed") {
      leadItems.push({
        ...base,
        key: `lead:${l["id"]}:email`,
        channel: "email",
        recipient: ((l["email_recipients"] as string[] | null) ?? []).join(", ") || null,
        reason: "lead_alert_email_failed",
        reasonDetail: (l["email_detail"] as string | null) ?? null,
        retryable: true,
        retryBlockedReason: null,
        staleWarning: Date.now() - new Date(base.lastAttemptAt).getTime() > STALE_AFTER_MS,
      });
    }
    if (l["teams_status"] === "failed") {
      leadItems.push({
        ...base,
        key: `lead:${l["id"]}:teams`,
        channel: "teams",
        recipient: "Teams channel",
        reason: "lead_alert_teams_failed",
        reasonDetail: (l["teams_detail"] as string | null) ?? null,
        retryable: true,
        retryBlockedReason: null,
        staleWarning: Date.now() - new Date(base.lastAttemptAt).getTime() > STALE_AFTER_MS,
      });
    }
  }

  const { listSuppressions } = await import("./notification-suppression.server");

  const items = [...notificationItems, ...leadItems].sort(
    (a, b) => new Date(b.lastAttemptAt).getTime() - new Date(a.lastAttemptAt).getTime(),
  );

  return { items, suppressions: await listSuppressions(admin), windowDays: WINDOW_DAYS };
}

/**
 * Re-attempts one failure through its original send path. Never duplicates a
 * send that already succeeded: each path re-reads current status first.
 */
export async function retryDeliveryFailure(
  admin: Admin,
  args: { ledger: "notification" | "lead"; id: string },
): Promise<{ ok: boolean; status: string; detail: string | null }> {
  if (args.ledger === "notification") {
    const { retryDelivery } = await import("./notification-email.server");
    const res = await retryDelivery(admin, args.id);
    if (res.errorCode === "already_sent")
      return { ok: true, status: "already_sent", detail: res.errorMessage };
    const ok = res.status === "delivered" || res.status === "provider_accepted";
    return { ok, status: res.status, detail: res.errorMessage };
  }

  const { data: row } = await admin
    .from("lead_notifications")
    .select("email_status, teams_status")
    .eq("id", args.id)
    .maybeSingle();
  if (!row) throw new Error("lead_notification_not_found");
  if (row.email_status === "sent" && row.teams_status === "delivered")
    return { ok: true, status: "already_sent", detail: "Both channels already succeeded." };

  const { retryLeadNotification } = await import("./leads/lead-pipeline.server");
  const res = await retryLeadNotification(args.id);
  return {
    ok: res.ok,
    status: res.ok ? "sent" : "failed",
    detail: res.error ?? null,
  };
}

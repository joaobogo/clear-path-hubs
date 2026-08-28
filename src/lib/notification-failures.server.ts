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
const SPIKE_WINDOW_HOURS = 6;

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
  ledger: "notification" | "lead" | "application";
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
function notificationRetry(
  status: string,
  code?: string | null,
): { retryable: boolean; reason: string | null } {
  const human = deliveryReason(code, status);
  if (human.kind === "held") return { retryable: false, reason: human.sentence };
  if (status === "bounced" || human.kind === "blocked") return { retryable: false, reason: human.sentence };
  return { retryable: true, reason: null };
}

function retrySpike(items: DeliveryFailure[]) {
  const now = Date.now();
  const windowMs = SPIKE_WINDOW_HOURS * 3_600_000;
  let recent = 0;
  let previous = 0;
  for (const item of items) {
    if (!item.retryable) continue;
    const age = now - new Date(item.lastAttemptAt).getTime();
    if (age >= 0 && age < windowMs) recent += 1;
    else if (age >= windowMs && age < windowMs * 2) previous += 1;
  }
  const active = recent >= 5 && recent >= Math.max(previous * 2, previous + 5);
  return {
    active,
    recent,
    previous,
    windowHours: SPIKE_WINDOW_HOURS,
    sentence: active
      ? `Retryable delivery failures increased to ${recent} in the last ${SPIKE_WINDOW_HOURS} hours.`
      : null,
  };
}

function inferLeadEmailCode(detail: string | null | undefined): string {
  const text = (detail ?? "").toLowerCase();
  for (const code of [
    "sandboxed_test_recipient",
    "no_matching_sender",
    "lovable_api_key_not_registered",
    "domain_not_verified",
    "emails_disabled",
    "email_credentials_missing",
    "recipient_suppressed",
  ]) {
    if (text.includes(code)) return code;
  }
  if (text.includes("test or demo workspace") || text.includes("demo workspace")) {
    return "sandboxed_test_recipient";
  }
  return "recipient_suppressed";
}

/**
 * The one metric contract every admin surface reads.
 *
 *   retryable      — the headline "delivery failures" number. Only these can be drained.
 *   blockedNotSent — suppressed / bounced addresses. Not failures; releasing the
 *                    address is the only thing that clears them.
 *   total          — retryable + blockedNotSent, for reconciliation copy only.
 */
export type DeliveryFailureSummary = {
  /** Every failure row in the window — always equals items.length. */
  total: number;
  /** Failures a retry can actually clear. THE headline number. */
  retryable: number;
  /** Deliveries never sent because the address is blocked. Never retryable. */
  blockedNotSent: number;
  /** Failed rows that are neither retryable nor suppression-blocked. */
  notRetryableOther: number;
  /** @deprecated Alias of blockedNotSent, kept for existing row copy. */
  blockedDeliveries: number;
  blockedAddresses: Array<{
    address: string;
    deliveries: number;
    lastAttemptAt: string;
    sentence: string;
  }>;
  spikeAlert: {
    active: boolean;
    recent: number;
    previous: number;
    windowHours: number;
    sentence: string | null;
  };
  windowDays: number;
};

const EMPTY_SUMMARY: DeliveryFailureSummary = {
  total: 0,
  retryable: 0,
  blockedNotSent: 0,
  notRetryableOther: 0,
  blockedDeliveries: 0,
  blockedAddresses: [],
  spikeAlert: {
    active: false,
    recent: 0,
    previous: 0,
    windowHours: SPIKE_WINDOW_HOURS,
    sentence: null,
  },
  windowDays: WINDOW_DAYS,
};

export async function loadDeliveryFailures(admin: Admin): Promise<{
  items: DeliveryFailure[];
  summary: DeliveryFailureSummary;
  suppressions: Array<{ id: string; email: string; reason: string | null; source: string; created_at: string }>;
  windowDays: number;
}> {
  const cutoff = since();

  const [deliveriesRes, leadsRes, applicationConfirmationsRes] = await Promise.all([
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
      .or("email_status.eq.failed,email_status.eq.suppressed,teams_status.eq.failed")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(200),
    (admin.from("applications") as any)
      .select(
        "id,position_id,candidate_profile_id,confirmation_email_status,confirmation_email_error_code,confirmation_email_error_message,confirmation_email_attempt_count,confirmation_email_last_attempt_at,confirmation_email_sent_at",
      )
      .in("confirmation_email_status", ["failed", "suppressed"])
      .gte("confirmation_email_last_attempt_at", cutoff)
      .order("confirmation_email_last_attempt_at", { ascending: false })
      .limit(200),
  ]);

  // Catch and normalize errors to prevent full page crashes in the desk view.
  if (deliveriesRes.error || leadsRes.error || applicationConfirmationsRes.error) {
    console.error("[loadDeliveryFailures] query failed", {
      deliveries: deliveriesRes.error,
      leads: leadsRes.error,
      applicationConfirmations: applicationConfirmationsRes.error,
    });
    return { items: [], summary: EMPTY_SUMMARY, suppressions: [], windowDays: WINDOW_DAYS };
  }

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
    const rawCode = (r["error_code"] as string | null) ?? null;
    const retry = notificationRetry(status, rawCode);
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
      eventLabel: humaniseEventType(`lead:${String(l["lead_type"])}`),
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
        reasonLabel: deliveryReason("lead_alert_email_failed").label,
        reasonSentence: deliveryReason("lead_alert_email_failed").sentence,
        canUnsuppress: false,
        retryable: true,
        retryBlockedReason: null,
        staleWarning: Date.now() - new Date(base.lastAttemptAt).getTime() > STALE_AFTER_MS,
      });
    }
    if (l["email_status"] === "suppressed") {
      // Visible, but never counted as a failure and never retryable: releasing
      // the address is the only thing that clears it.
      const reason = inferLeadEmailCode(l["email_detail"] as string | null);
      const human = deliveryReason(reason);
      leadItems.push({
        ...base,
        key: `lead:${l["id"]}:email-suppressed`,
        channel: "email",
        recipient: ((l["email_recipients"] as string[] | null) ?? []).join(", ") || null,
        reason,
        reasonDetail: (l["email_detail"] as string | null) ?? null,
        reasonLabel: human.label,
        reasonSentence: human.sentence,
        canUnsuppress: human.kind === "blocked",
        retryable: false,
        retryBlockedReason:
          human.kind === "blocked"
            ? "Not sent because the recipient is on the suppression list. Release the address to resume sending."
            : human.sentence,
        staleWarning: false,
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
        reasonLabel: deliveryReason("lead_alert_teams_failed").label,
        reasonSentence: deliveryReason("lead_alert_teams_failed").sentence,
        canUnsuppress: false,
        retryable: true,
        retryBlockedReason: null,
        staleWarning: Date.now() - new Date(base.lastAttemptAt).getTime() > STALE_AFTER_MS,
      });
    }
  }

  const applicationRows = (applicationConfirmationsRes.data ?? []) as Array<Record<string, unknown>>;
  const profileIds = [
    ...new Set(
      applicationRows
        .map((r) => r["candidate_profile_id"] as string | null)
        .filter((v): v is string => !!v),
    ),
  ];
  const positionIds = [
    ...new Set(
      applicationRows
        .map((r) => r["position_id"] as string | null)
        .filter((v): v is string => !!v),
    ),
  ];
  const [profilesRes, positionsRes] = await Promise.all([
    profileIds.length
      ? admin.from("candidate_profiles").select("id,full_name,email").in("id", profileIds)
      : { data: [] },
    positionIds.length
      ? admin.from("positions").select("id,title").in("id", positionIds)
      : { data: [] },
  ]);
  const profileById = new Map(
    ((profilesRes.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((p) => [p.id, p]),
  );
  const positionById = new Map(
    ((positionsRes.data ?? []) as Array<{ id: string; title: string | null }>).map((p) => [p.id, p]),
  );
  const applicationItems: DeliveryFailure[] = applicationRows.map((r) => {
    const status = String(r["confirmation_email_status"] ?? "failed");
    const rawCode = (r["confirmation_email_error_code"] as string | null) ?? null;
    const human = deliveryReason(rawCode, status);
    const retry = notificationRetry(status, rawCode);
    const lastAttemptAt = String(r["confirmation_email_last_attempt_at"] ?? r["confirmation_email_sent_at"] ?? new Date().toISOString());
    const profile = profileById.get(String(r["candidate_profile_id"]));
    const position = positionById.get(String(r["position_id"]));
    return {
      key: `application:${r["id"]}`,
      ledger: "application" as const,
      id: String(r["id"]),
      eventType: "application_received",
      eventLabel: "Application confirmation",
      title: position?.title ? `Application received — ${position.title}` : "Application received",
      audience: "candidate",
      channel: "email",
      recipient: profile?.email ?? null,
      reason: rawCode ?? status,
      reasonDetail: (r["confirmation_email_error_message"] as string | null) ?? null,
      reasonLabel: human.label,
      reasonSentence: human.sentence,
      canUnsuppress: human.kind === "blocked",
      attempts: Number(r["confirmation_email_attempt_count"] ?? 1),
      firstAttemptAt: lastAttemptAt,
      lastAttemptAt,
      retryable: retry.retryable,
      retryBlockedReason: retry.reason,
      staleWarning: isStale("application_received", lastAttemptAt),
      relatedPath: `/apply/received/${r["id"]}`,
      payloadJson: JSON.stringify({
        application_id: r["id"],
        event_type: "application_received",
        candidate_name: profile?.full_name ?? null,
        recipient_address: profile?.email ?? null,
        status,
        error_code: rawCode,
      }, null, 2),
    };
  });

  const { listSuppressions } = await import("./notification-suppression.server");

  // The window is enforced here, on the last attempt, so no caller has to
  // re-filter afterwards. Re-filtering downstream is what made /admin read 13
  // while /admin/operations read 86 off the same ledger.
  const items = [...notificationItems, ...leadItems, ...applicationItems]
    .filter((i) => i.lastAttemptAt >= cutoff)
    .sort((a, b) => new Date(b.lastAttemptAt).getTime() - new Date(a.lastAttemptAt).getTime());

  // A suppressed address does not produce a backlog an operator can drain: every
  // new notification to it fails again the moment it is sent, so the row count
  // grows with normal console use. Those rows are reported as addresses to
  // resolve, not as deliveries to retry.
  const blockedByAddress = new Map<
    string,
    { address: string; deliveries: number; lastAttemptAt: string; sentence: string }
  >();
  for (const it of items) {
    if (it.retryable) continue;
    if (!it.canUnsuppress && it.reason !== "recipient_suppressed") continue;
    const address = it.recipient ?? "Address not on file";
    const prev = blockedByAddress.get(address);
    if (prev) {
      prev.deliveries += 1;
      if (it.lastAttemptAt > prev.lastAttemptAt) prev.lastAttemptAt = it.lastAttemptAt;
    } else {
      blockedByAddress.set(address, {
        address,
        deliveries: 1,
        lastAttemptAt: it.lastAttemptAt,
        sentence: it.reasonSentence,
      });
    }
  }
  const blockedAddresses = [...blockedByAddress.values()].sort(
    (a, b) => b.deliveries - a.deliveries,
  );
  const retryableCount = items.filter((i) => i.retryable).length;
  const blockedNotSent = blockedAddresses.reduce((n, a) => n + a.deliveries, 0);
  const spikeAlert = retrySpike(items);

  return {
    items,
    summary: {
      // The list total IS the list. `retryable + blockedNotSent` skipped rows
      // that are neither (held/config/bounced/non-email channels), so
      // "Rows listed below: 229" sat above a panel rendering 277 rows and
      // three admin pages showed three different failure counts (audit A-05).
      total: items.length,
      retryable: retryableCount,
      blockedNotSent,
      /** Failed rows that are neither retryable nor suppression-blocked. */
      notRetryableOther: items.length - retryableCount - blockedNotSent,
      blockedDeliveries: blockedNotSent,
      blockedAddresses,
      spikeAlert,
      windowDays: WINDOW_DAYS,
    },
    suppressions: await listSuppressions(admin),
    windowDays: WINDOW_DAYS,
  };
}

/**
 * Re-attempts one failure through its original send path. Never duplicates a
 * send that already succeeded: each path re-reads current status first.
 */
export async function retryDeliveryFailure(
  admin: Admin,
  args: { ledger: "notification" | "lead" | "application"; id: string },
): Promise<{ ok: boolean; status: string; detail: string | null }> {
  if (args.ledger === "notification") {
    const { retryDelivery } = await import("./notification-email.server");
    const res = await retryDelivery(admin, args.id);
    if (res.errorCode === "already_sent")
      return { ok: true, status: "already_sent", detail: res.errorMessage };
    const ok = res.status === "delivered" || res.status === "provider_accepted";
    return { ok, status: res.status, detail: res.errorMessage };
  }
  if (args.ledger === "application") {
    const { sendApplicationConfirmationEmail } = await import("./application-confirmation-email.server");
    const res = await sendApplicationConfirmationEmail(admin, args.id, { force: true });
    return {
      ok: res.status === "sent" || res.status === "already_sent",
      status: res.status,
      detail: res.reason,
    };
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

/**
 * Clear the blocks on one address and re-attempt the delivery that exposed it.
 *
 * This is the single backend path behind both the admin "Remove from
 * suppression & retry" row action and the recipient-facing "Email blocked"
 * banner action. It never claims success it did not observe: if the provider's
 * global list still blocks the address, the retry result says so.
 */
export async function unsuppressAndRetry(
  admin: Admin,
  args: { email: string; actorUserId: string; ledger?: "notification" | "lead" | "application"; id?: string },
): Promise<{
  unsuppress: Awaited<ReturnType<typeof import("./notification-suppression.server").unsuppressRecipient>>;
  retry: { attempted: boolean; ok: boolean; status: string; detail: string | null };
}> {
  const { unsuppressRecipient } = await import("./notification-suppression.server");
  const unsuppress = await unsuppressRecipient(admin, {
    email: args.email,
    actorUserId: args.actorUserId,
  });

  if (!args.ledger || !args.id) {
    return {
      unsuppress,
      retry: { attempted: false, ok: false, status: "not_requested", detail: null },
    };
  }

  const res = await retryDeliveryFailure(admin, { ledger: args.ledger, id: args.id });
  return { unsuppress, retry: { attempted: true, ...res } };
}

export async function retryAllDeliveryFailures(
  admin: Admin,
  args: { limit?: number } = {},
): Promise<{ ok: boolean; attempted: number; succeeded: number; failed: number; skipped: number }> {
  const queue = await loadDeliveryFailures(admin);
  const limit = Math.min(Math.max(args.limit ?? 100, 1), 200);
  const items = queue.items.filter((item) => item.retryable).slice(0, limit);
  let succeeded = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const res = await retryDeliveryFailure(admin, { ledger: item.ledger, id: item.id });
      if (res.ok) succeeded += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  const skipped = queue.items.filter((item) => item.retryable).length - items.length;
  return { ok: failed === 0, attempted: items.length, succeeded, failed, skipped };
}

/**
 * The single canonical delivery-health payload. Every admin surface that shows
 * a delivery-failure number reads this — /admin, /admin/operations,
 * /admin/health, /admin/notifications and /admin/integrations.
 *
 * There is deliberately no window argument: the 7-day window in this module is
 * the definition of the metric.
 */
export async function loadDeliveryHealth(admin: Admin) {
  const failures = await loadDeliveryFailures(admin);
  const { readEmailConfig } = await import("./notification-email.server");

  const counts: Record<string, number> = {};
  for (const item of failures.items) {
    const k = `${item.channel}:${item.ledger}:${item.reason}`;
    counts[k] = (counts[k] ?? 0) + 1;
  }

  // Sent volume is not derivable from the failure ledger, so read it from the
  // delivery table directly over the same window.
  const since = new Date(Date.now() - failures.windowDays * 86_400_000).toISOString();
  const volume = { emailSent: 0, inAppDelivered: 0 };
  const { data: sentRows } = await admin
    .from("notification_deliveries")
    .select("channel, status")
    .gte("created_at", since)
    .in("status", ["provider_accepted", "delivered"]);
  for (const row of (sentRows ?? []) as Array<{ channel: string; status: string }>) {
    if (row.channel === "email") volume.emailSent += 1;
    else if (row.channel === "in_app") volume.inAppDelivered += 1;
  }

  const cfg = readEmailConfig();
  return {
    items: failures.items,
    counts,
    summary: failures.summary,
    suppressions: failures.suppressions,
    volume,
    windowDays: failures.windowDays,
    window_days: failures.windowDays,
    // Never expose keys — only whether a provider is usable and why not.
    email: { configured: cfg.configured, reason: cfg.reason },
  };
}

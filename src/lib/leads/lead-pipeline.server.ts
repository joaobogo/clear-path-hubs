/**
 * Lead notification pipeline. SERVER ONLY.
 *
 * One entry point — `processLeadEvent` — for every lead produced anywhere on
 * the website. Processing order is fixed and each step is independent:
 *
 *   1. Persist the ledger row (idempotent on the lead event key).
 *   2. Post the Microsoft Teams card.
 *   3. Send the internal email alert to the configured recipients.
 *   4. Record per-channel success/failure so delivery is traceable and retryable.
 *
 * A failure in any channel never throws into the caller: the lead's own
 * primary record and the visitor's confirmation must never depend on Teams or
 * email being healthy.
 */
import {
  LEAD_TYPE_LABEL,
  appOrigin,
  leadAlertRecipients,
} from "@/config/lead-notifications";
import { normalizeLeadEvent, type LeadEventInput, type NormalizedLeadEvent } from "./lead-event";

export type LeadDispatchResult = {
  leadNotificationId: string | null;
  duplicate: boolean;
  teams: { ok: boolean; detail: string | null };
  email: { ok: boolean; detail: string | null; recipients: string[] };
};

const PRIORITY_PREFIX = {
  urgent: "🔴 Urgent",
  high: "🟠 Priority",
  standard: "🟢 New",
} as const;

function teamsNotice(event: NormalizedLeadEvent) {
  const label = LEAD_TYPE_LABEL[event.leadType];
  return {
    title: `${PRIORITY_PREFIX[event.priority]} lead — ${label}`,
    subtitle: [event.fullName, event.company].filter(Boolean).join(" · ") || label,
    facts: [
      { label: "Email", value: event.email },
      { label: "Phone", value: event.phone },
      { label: "Company", value: event.company },
      ...event.facts,
      { label: "Source", value: event.source },
      { label: "Page", value: event.sourcePage },
      { label: "Owner", value: event.ownerEmail },
      { label: "Received", value: new Date().toISOString() },
      { label: "Message", value: event.message },
      { label: "Reference", value: event.recordId },
    ],
    linkPath: event.linkPath,
    linkLabel: "Open in TaaSFlow",
  };
}

async function sendTeams(event: NormalizedLeadEvent) {
  try {
    const { notifyTeams } = await import("@/lib/teams-notify.server");
    const res = await notifyTeams(teamsNotice(event));
    return { ok: res.ok, detail: res.ok ? null : (res.reason ?? "unknown") };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message.slice(0, 400) : "throw" };
  }
}

async function sendEmail(event: NormalizedLeadEvent, recipients: string[]) {
  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const templateData = {
      leadTypeLabel: LEAD_TYPE_LABEL[event.leadType],
      priority: event.priority,
      fullName: event.fullName,
      email: event.email,
      company: event.company,
      phone: event.phone,
      message: event.message,
      facts: event.facts,
      source: event.source,
      sourcePage: event.sourcePage,
      ownerEmail: event.ownerEmail,
      reference: event.recordId,
      receivedAt: new Date().toISOString(),
      actionUrl: `${appOrigin()}${event.linkPath}`,
    };

    const failures: string[] = [];
    for (const to of recipients) {
      try {
        const res = await sendTemplateEmail("internal-lead-alert", to, {
          idempotencyKey: `lead-alert:${event.idempotencyKey}:${to}`,
          templateData,
          replyTo: event.email ?? undefined,
        });
        if (!res.sent) failures.push(`${to}: ${res.reason}`);
      } catch (err) {
        failures.push(`${to}: ${err instanceof Error ? err.message.slice(0, 160) : "error"}`);
      }
    }
    return {
      ok: failures.length < recipients.length,
      detail: failures.length > 0 ? failures.join("; ").slice(0, 500) : null,
    };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message.slice(0, 400) : "throw" };
  }
}

/**
 * Records the lead and fans out the notifications. Safe to call more than once
 * for the same lead: the second call returns `duplicate: true` and sends
 * nothing.
 */
export async function processLeadEvent(input: LeadEventInput): Promise<LeadDispatchResult> {
  const event = normalizeLeadEvent(input);
  const result: LeadDispatchResult = {
    leadNotificationId: null,
    duplicate: false,
    teams: { ok: false, detail: "not_attempted" },
    email: { ok: false, detail: "not_attempted", recipients: [] },
  };

  let admin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
  try {
    admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  } catch (err) {
    console.error("[leads] cannot reach database", err);
    return result;
  }

  const recipients = leadAlertRecipients(event.leadType);

  // 1) Ledger row — idempotent.
  const { data: row, error } = await admin
    .from("lead_notifications")
    .insert({
      idempotency_key: event.idempotencyKey,
      lead_type: event.leadType,
      source: event.source,
      source_page: event.sourcePage,
      priority: event.priority,
      owner_email: event.ownerEmail,
      full_name: event.fullName,
      email: event.email,
      company: event.company,
      phone: event.phone,
      message: event.message,
      record_table: event.recordTable,
      record_id: event.recordId,
      organization_id: event.organizationId,
      position_id: event.positionId,
      email_recipients: recipients,
      crm_status: event.crmStatus,
      crm_detail: event.crmDetail,
      payload: {
        facts: event.facts,
        attribution: event.attribution,
        link_path: event.linkPath,
      } as never,
      attempts: 1,
      last_attempt_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    // Unique violation = the same lead event already landed. Never re-notify.
    if (error.code === "23505") {
      const { data: existing } = await admin
        .from("lead_notifications")
        .select("id")
        .eq("idempotency_key", event.idempotencyKey)
        .maybeSingle();
      return { ...result, leadNotificationId: existing?.id ?? null, duplicate: true };
    }
    console.error("[leads] ledger insert failed", { key: event.idempotencyKey, code: error.code });
    // Still notify — losing the ledger row must not lose the lead.
  } else {
    result.leadNotificationId = row.id;
  }

  // 2 + 3) Channels, independent of one another.
  const [teams, email] = await Promise.all([sendTeams(event), sendEmail(event, recipients)]);
  result.teams = teams;
  result.email = { ...email, recipients };

  // 4) Delivery record.
  if (result.leadNotificationId) {
    const now = new Date().toISOString();
    await admin
      .from("lead_notifications")
      .update({
        teams_status: teams.ok ? "delivered" : "failed",
        teams_detail: teams.detail,
        teams_at: now,
        email_status: email.ok ? "sent" : "failed",
        email_detail: email.detail,
        email_at: now,
      })
      .eq("id", result.leadNotificationId);
  }

  return result;
}

/** Fire-and-forget variant for call sites that must not wait on delivery. */
export function processLeadEventSafe(input: LeadEventInput): void {
  void processLeadEvent(input).catch((err) => {
    console.error("[leads] dispatch threw", err);
  });
}

/**
 * Re-attempts the failed channels of an existing ledger row. Used by the admin
 * lead-delivery view; never re-sends a channel that already succeeded.
 */
export async function retryLeadNotification(
  id: string,
): Promise<{ ok: boolean; teams: boolean | null; email: boolean | null; error?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin
    .from("lead_notifications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !row) return { ok: false, teams: null, email: null, error: "not_found" };

  const payload = (row.payload ?? {}) as {
    facts?: Array<{ label: string; value: string }>;
    attribution?: Record<string, unknown> | null;
    link_path?: string;
  };

  const event = normalizeLeadEvent({
    leadType: row.lead_type as never,
    sourceId: String(row.idempotency_key).split(":").slice(1).join(":") || row.id,
    source: row.source,
    sourcePage: row.source_page,
    fullName: row.full_name,
    email: row.email,
    company: row.company,
    phone: row.phone,
    message: row.message,
    facts: payload.facts ?? [],
    recordTable: row.record_table,
    recordId: row.record_id,
    organizationId: row.organization_id,
    positionId: row.position_id,
    linkPath: payload.link_path ?? null,
    priority: row.priority as never,
    ownerEmail: row.owner_email,
    attribution: payload.attribution ?? null,
  });

  const recipients =
    (row.email_recipients as string[] | null)?.length
      ? (row.email_recipients as string[])
      : leadAlertRecipients(event.leadType);

  const needsTeams = row.teams_status !== "delivered";
  const needsEmail = row.email_status !== "sent";

  const teams = needsTeams ? await sendTeams(event) : null;
  // A retry is a new send attempt, so it needs a distinct idempotency key.
  const email = needsEmail
    ? await sendEmail(
        { ...event, idempotencyKey: `${event.idempotencyKey}:retry:${Date.now()}` },
        recipients,
      )
    : null;

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("lead_notifications")
    .update({
      attempts: (row.attempts ?? 0) + 1,
      last_attempt_at: now,
      ...(teams
        ? {
            teams_status: teams.ok ? "delivered" : "failed",
            teams_detail: teams.detail,
            teams_at: now,
          }
        : {}),
      ...(email
        ? {
            email_status: email.ok ? "sent" : "failed",
            email_detail: email.detail,
            email_at: now,
          }
        : {}),
    })
    .eq("id", id);

  return { ok: (teams?.ok ?? true) && (email?.ok ?? true), teams: teams?.ok ?? null, email: email?.ok ?? null };
}

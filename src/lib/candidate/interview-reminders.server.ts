/**
 * Interview reminders and no-shows.
 * ------------------------------------------------------------------
 * Two reminders — roughly 24 hours out and roughly 1 hour out — then, once a
 * slot has passed without anyone marking it complete, a no-show flag that tells
 * the recruiter and offers the candidate a rebooking.
 *
 * Idempotency lives in the database: reminder_24h_sent_at, reminder_1h_sent_at
 * and no_show_flagged_at are written after each step, so running this sweep
 * repeatedly is safe.
 */

import { notificationAllowed } from "./notification-events";

export interface ReminderSweepResult {
  considered: number;
  sent_24h: number;
  sent_1h: number;
  no_shows: number;
  skipped: number;
  failed: number;
}

const HOUR_MS = 60 * 60 * 1000;
/** How late a scheduled interview must be before we call it a no-show. */
export const NO_SHOW_GRACE_MS = 2 * HOUR_MS;

/** Human time label in the candidate's own timezone. */
export function formatSlotLabel(iso: string, timezone: string | null | undefined): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone || "UTC",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  }
}

/** Which reminder, if any, is due for a scheduled interview right now. */
export function dueReminder(i: {
  scheduledAt: string;
  reminder24hSentAt: string | null;
  reminder1hSentAt: string | null;
  now?: Date;
}): "24h" | "1h" | null {
  const now = (i.now ?? new Date()).getTime();
  const start = new Date(i.scheduledAt).getTime();
  if (!Number.isFinite(start)) return null;
  const msAway = start - now;
  if (msAway <= 0) return null;
  if (msAway <= 90 * 60 * 1000 && !i.reminder1hSentAt) return "1h";
  if (msAway <= 26 * HOUR_MS && msAway > 90 * 60 * 1000 && !i.reminder24hSentAt) return "24h";
  return null;
}

/** True when a scheduled interview is late enough to be treated as a no-show. */
export function isNoShow(i: {
  scheduledAt: string;
  status: string;
  completedAt: string | null;
  cancelledAt: string | null;
  noShowFlaggedAt: string | null;
  now?: Date;
}): boolean {
  if (i.status !== "scheduled") return false;
  if (i.completedAt || i.cancelledAt || i.noShowFlaggedAt) return false;
  const start = new Date(i.scheduledAt).getTime();
  if (!Number.isFinite(start)) return false;
  return (i.now ?? new Date()).getTime() - start >= NO_SHOW_GRACE_MS;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export async function runInterviewReminders(limit = 200): Promise<ReminderSweepResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendTemplateEmail } = await import("../email-templates/send-email");

  const result: ReminderSweepResult = {
    considered: 0,
    sent_24h: 0,
    sent_1h: 0,
    no_shows: 0,
    skipped: 0,
    failed: 0,
  };

  const from = new Date(Date.now() - 24 * HOUR_MS).toISOString();
  const to = new Date(Date.now() + 30 * HOUR_MS).toISOString();

  const { data, error } = await supabaseAdmin
    .from("interviews")
    .select(
      `id,status,scheduled_at,completed_at,cancelled_at,timezone,meeting_url,location,
       reminder_24h_sent_at,reminder_1h_sent_at,no_show_flagged_at,organization_id,
       candidate_matches(id,candidate_profiles(full_name,email,consent,timezone),positions(title,organizations(name)))`,
    )
    .eq("status", "scheduled")
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", from)
    .lte("scheduled_at", to)
    .limit(limit);

  if (error || !data) {
    if (error) console.error("[interview-reminders] query failed", error.message);
    return result;
  }

  const now = new Date();

  for (const row of data as Any[]) {
    result.considered += 1;
    const match = row.candidate_matches as Any;
    const cp = match?.candidate_profiles as Any;
    const pos = match?.positions as Any;

    // Late and unaccounted for — flag the no-show, do not send a reminder.
    if (
      isNoShow({
        scheduledAt: String(row.scheduled_at),
        status: String(row.status),
        completedAt: row.completed_at ?? null,
        cancelledAt: row.cancelled_at ?? null,
        noShowFlaggedAt: row.no_show_flagged_at ?? null,
        now,
      })
    ) {
      try {
        await supabaseAdmin
          .from("interviews")
          .update({ no_show_flagged_at: now.toISOString() })
          .eq("id", row.id)
          .is("no_show_flagged_at", null);

        if (row.organization_id) {
          await supabaseAdmin.rpc("notify_platform_staff", {
            _organization_id: row.organization_id,
            _event_type: "approval_needed",
            _title: "Interview slot passed with no outcome",
            _body: `${cp?.full_name ?? "A candidate"} — ${pos?.title ?? "role"}. Nobody marked it complete or cancelled. Confirm what happened and offer a rebooking.`,
            _link_path: `/admin/interviews`,
          });
        }
        result.no_shows += 1;
      } catch (err) {
        console.error("[interview-reminders] no-show flag failed", (err as Error)?.message);
        result.failed += 1;
      }
      continue;
    }

    const due = dueReminder({
      scheduledAt: String(row.scheduled_at),
      reminder24hSentAt: row.reminder_24h_sent_at ?? null,
      reminder1hSentAt: row.reminder_1h_sent_at ?? null,
      now,
    });
    if (!due) {
      result.skipped += 1;
      continue;
    }
    if (!cp?.email || !notificationAllowed(cp.consent ?? null, "interview_invitation")) {
      result.skipped += 1;
      continue;
    }

    const timezone = cp.timezone ?? row.timezone ?? "UTC";
    try {
      const outcome = await sendTemplateEmail("interview-reminder", cp.email, {
        idempotencyKey: `interview-reminder-${due}-${row.id}`,
        templateData: {
          candidateFirstName: (cp.full_name ?? "").trim().split(" ")[0] || null,
          positionTitle: pos?.title ?? null,
          organizationName: pos?.organizations?.name ?? null,
          whenLabel: formatSlotLabel(String(row.scheduled_at), timezone),
          timezone,
          meetingUrl: row.meeting_url ?? null,
          location: row.location ?? null,
          manageUrl: "https://taasflow.com/me/interviews",
          window: due,
        },
      });

      const column = due === "1h" ? "reminder_1h_sent_at" : "reminder_24h_sent_at";
      const stamp =
        due === "1h"
          ? { reminder_1h_sent_at: now.toISOString() }
          : { reminder_24h_sent_at: now.toISOString() };
      await supabaseAdmin.from("interviews").update(stamp).eq("id", row.id).is(column, null);

      if (outcome?.sent) {
        if (due === "1h") result.sent_1h += 1;
        else result.sent_24h += 1;
      } else {
        result.skipped += 1;
      }
    } catch (err) {
      console.error("[interview-reminders] send failed", (err as Error)?.message);
      result.failed += 1;
    }
  }

  return result;
}

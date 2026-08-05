/**
 * Native scheduling — server only.
 *
 * Availability, double-booking prevention, and the confirm / reschedule / cancel
 * writes for booking_sessions. We are the source of truth: a slot is taken when
 * another non-cancelled booking overlaps it, or when the host's Outlook calendar
 * is busy for it (only when Outlook is configured).
 *
 * Every external integration in here is best-effort. A Graph failure records an
 * error on the row and still confirms the booking.
 */
import { HOST_NAME, HOST_EMAIL, MEETING_JOIN_URL } from "@/config/scheduler";
import { generateSlots, removeBooked, isValidTimezone, fullLabel, type Slot } from "@/lib/booking/slots";
import { resolveSlotRules } from "@/lib/booking/scheduling-settings.server";
import {
  cancelBookingEvent,
  createBookingEvent,
  fetchHostBusy,
  updateBookingEvent,
} from "@/lib/booking/outlook.server";

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function admin(): Promise<AdminClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const HOST = { name: HOST_NAME, email: HOST_EMAIL, joinUrl: MEETING_JOIN_URL } as const;

/** Intervals already held by a live booking inside [from, to]. */
async function busyIntervals(
  from: string,
  to: string,
  excludeSessionId?: string | null,
): Promise<Array<{ start: string; end: string }>> {
  const db = await admin();
  let query = db
    .from("booking_sessions")
    .select("id, scheduled_start, scheduled_end")
    .not("scheduled_start", "is", null)
    .neq("status", "cancelled")
    .lt("scheduled_start", to)
    .gt("scheduled_end", from);
  if (excludeSessionId) query = query.neq("id", excludeSessionId);

  const { data, error } = await query;
  if (error) throw new Error(`booking_availability_read_failed: ${error.message}`);
  return (data ?? [])
    .filter((row) => row.scheduled_start && row.scheduled_end)
    .map((row) => ({ start: row.scheduled_start as string, end: row.scheduled_end as string }));
}

export type Availability = {
  slots: Slot[];
  hostTimezone: string;
  slotMinutes: number;
};

/** Open slots across the booking horizon, minus everything already taken. */
export async function loadAvailability(
  opts: { excludeSessionId?: string | null } = {},
): Promise<Availability> {
  const rules = await resolveSlotRules();
  const all = generateSlots(rules);
  if (all.length === 0) {
    return { slots: [], hostTimezone: rules.hostTimezone, slotMinutes: rules.slotMinutes };
  }
  const from = all[0]!.start;
  const to = all[all.length - 1]!.end;

  // Our own bookings are authoritative; Outlook busy time is additive and
  // silently empty when the integration isn't configured.
  const [ours, outlook] = await Promise.all([
    busyIntervals(from, to, opts.excludeSessionId ?? null),
    fetchHostBusy(from, to),
  ]);

  return {
    slots: removeBooked(all, [...ours, ...outlook]),
    hostTimezone: rules.hostTimezone,
    slotMinutes: rules.slotMinutes,
  };
}

export type BookedMeeting = {
  sessionId: string;
  scheduledStart: string;
  scheduledEnd: string;
  timezone: string;
  hostName: string;
  joinUrl: string | null;
  status: "scheduled";
};

export type BookOutcome =
  | { ok: true; meeting: BookedMeeting; firstName: string; email: string; rescheduled: boolean }
  | { ok: false; reason: "not_found" | "slot_taken" | "invalid_slot" | "already_cancelled" };

/**
 * Claims a slot for an existing intake row. The slot must be one we actually
 * offer AND still free at write time, so a stale browser cannot double-book.
 */
export async function bookSlot(input: {
  sessionId: string;
  start: string;
  timezone: string;
}): Promise<BookOutcome> {
  const db = await admin();
  const rules = await resolveSlotRules();
  const timezone = isValidTimezone(input.timezone) ? input.timezone : rules.hostTimezone;

  const { data: row } = await db
    .from("booking_sessions")
    .select(
      "id, status, first_name, last_name, email, company_name, scheduled_start, graph_event_id",
    )
    .eq("id", input.sessionId)
    .maybeSingle();
  if (!row) return { ok: false, reason: "not_found" };
  if (row.status === "cancelled") return { ok: false, reason: "already_cancelled" };

  const offered = generateSlots(rules).find((slot) => slot.start === input.start);
  if (!offered) return { ok: false, reason: "invalid_slot" };

  const busy = await busyIntervals(offered.start, offered.end, input.sessionId);
  if (busy.length > 0) return { ok: false, reason: "slot_taken" };

  const wasScheduled = Boolean(row.scheduled_start);

  // Outlook event: create on first booking, move on reschedule. Non-blocking —
  // a failure is recorded and the booking still stands.
  const attendeeName = `${row.first_name} ${row.last_name}`.trim();
  const eventInput = {
    subject: `TaaSFlow hiring call — ${row.company_name ?? attendeeName}`,
    bodyHtml: `<p>Hiring discovery call with ${attendeeName}${
      row.company_name ? ` (${row.company_name})` : ""
    }.</p><p>Booked at ${fullLabel(offered.start, offered.end, timezone)}.</p>`,
    startIso: offered.start.replace("Z", ""),
    endIso: offered.end.replace("Z", ""),
    attendeeEmail: row.email,
    attendeeName,
  };
  const calendar = row.graph_event_id
    ? await updateBookingEvent(row.graph_event_id, eventInput)
    : await createBookingEvent(eventInput);

  const joinUrl =
    calendar.status === "ok" && calendar.joinUrl ? calendar.joinUrl : HOST.joinUrl;

  const now = new Date().toISOString();
  const { error } = await db
    .from("booking_sessions")
    .update({
      status: "scheduled",
      scheduled_start: offered.start,
      scheduled_end: offered.end,
      timezone,
      host_name: HOST.name,
      host_email: HOST.email,
      join_url: joinUrl,
      scheduled_at: now,
      cancelled_at: null,
      reminder_sent_at: null,
      ...(calendar.status === "ok"
        ? { graph_event_id: calendar.eventId, graph_synced_at: now, graph_error: null }
        : calendar.status === "error"
          ? { graph_error: calendar.error }
          : {}),
    })
    .eq("id", input.sessionId);
  if (error) return { ok: false, reason: "not_found" };

  return {
    ok: true,
    rescheduled: wasScheduled,
    firstName: row.first_name,
    email: row.email,
    meeting: {
      sessionId: input.sessionId,
      scheduledStart: offered.start,
      scheduledEnd: offered.end,
      timezone,
      hostName: HOST.name,
      joinUrl,
      status: "scheduled",
    },
  };
}

export type CancelOutcome =
  | {
      ok: true;
      email: string;
      firstName: string;
      scheduledStart: string | null;
      timezone: string | null;
    }
  | { ok: false; reason: "not_found" };

/** Cancels a meeting and frees its slot for everybody else. */
export async function cancelBooking(sessionId: string): Promise<CancelOutcome> {
  const db = await admin();

  const { data: existing } = await db
    .from("booking_sessions")
    .select("graph_event_id")
    .eq("id", sessionId)
    .maybeSingle();

  // Pull the event off the host's calendar first so a cancelled booking never
  // leaves a ghost meeting behind. Still non-blocking.
  let graphError: string | null = null;
  if (existing?.graph_event_id) {
    const result = await cancelBookingEvent(
      existing.graph_event_id,
      "This call was cancelled from the TaaSFlow booking page.",
    );
    if (result.status === "error") graphError = result.error ?? "graph_cancel_failed";
  }

  const { data, error } = await db
    .from("booking_sessions")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      ...(graphError ? { graph_error: graphError } : { graph_error: null }),
    })
    .eq("id", sessionId)
    .select("id, email, first_name, scheduled_start, timezone")
    .maybeSingle();
  if (error || !data) return { ok: false, reason: "not_found" };
  return {
    ok: true,
    email: data.email,
    firstName: data.first_name,
    scheduledStart: data.scheduled_start,
    timezone: data.timezone,
  };
}

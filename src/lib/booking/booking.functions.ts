/**
 * Booking server functions — the only booking RPC surface the browser touches.
 *
 * These are intentionally unauthenticated (visitors are anonymous) and therefore
 * validate every field with Zod and never return anything but the caller's own
 * booking session.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { resolveMeetingType } from "@/config/booking";
import { bookingIntakeSchema } from "@/lib/booking/booking-schema";

const attributionSchema = z.record(z.string(), z.string().nullable()).default({});

const submitSchema = z.object({
  intake: bookingIntakeSchema,
  meetingType: z.string().optional(),
  attribution: attributionSchema,
  /** Honeypot — must stay empty. */
  honeypot: z.string().optional(),
});

function environment(): "production" | "preview" {
  return process.env["NODE_ENV"] === "production" ? "production" : "preview";
}

/**
 * Step 1 → 2. Stores the intake and mirrors it to the CRM, then hands back the
 * session id the scheduler step attaches the meeting to.
 */
export const submitBookingIntake = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.honeypot && data.honeypot.trim().length > 0) {
      // Silent success for bots: nothing stored, nothing synced.
      return { sessionId: null as string | null, qualificationScore: 0 };
    }

    const meetingType = resolveMeetingType(data.meetingType);
    const { storeBookingIntake, syncBookingLeadToCrm } = await import(
      "@/lib/booking/booking.server"
    );

    const stored = await storeBookingIntake({
      intake: data.intake,
      meetingType,
      attribution: data.attribution,
    });

    // CRM mirroring must never block the visitor from picking a time.
    await syncBookingLeadToCrm({
      sessionId: stored.sessionId,
      intake: data.intake,
      meetingType,
      attribution: data.attribution,
      environment: environment(),
    });

    // Unified lead notification: the meeting request is already a lead, even
    // before a time is picked.
    try {
      const { processLeadEvent } = await import("@/lib/leads/lead-pipeline.server");
      await processLeadEvent({
        leadType: "discovery_call",
        sourceId: stored.sessionId,
        source: "booking_intake",
        sourcePage: "/book",
        fullName: `${data.intake.firstName} ${data.intake.lastName}`.trim(),
        email: data.intake.email,
        company: data.intake.companyName ?? null,
        phone: data.intake.phone ?? null,
        message: data.intake.additionalContext ?? data.intake.hiringChallenge ?? null,
        facts: [
          { label: "Meeting type", value: meetingType },
          { label: "Job title", value: data.intake.jobTitle },
          { label: "Open roles", value: data.intake.openRoles },
          { label: "Hiring volume", value: data.intake.hiringVolume },
          { label: "Timeline", value: data.intake.hiringTimeline },
          { label: "Qualification score", value: stored.qualificationScore },
          { label: "Meeting time", value: "not picked yet" },
        ],
        recordTable: "booking_sessions",
        recordId: stored.sessionId,
        linkPath: "/admin/pending-leads",
        crmStatus: "synced",
      });
    } catch (err) {
      console.error("[booking] lead notification failed", err);
    }

    return { sessionId: stored.sessionId as string | null, qualificationScore: stored.qualificationScore };
  });

const confirmSchema = z.object({
  sessionId: z.string().uuid(),
  calendlyEventUri: z.string().max(500).nullable().optional(),
  calendlyInviteeUri: z.string().max(500).nullable().optional(),
  timezone: z.string().max(120).nullable().optional(),
});

/**
 * Confirms from the browser that the visitor completed the scheduler. The
 * signed Calendly webhook remains the authority for times, host, and links —
 * this only flips our row promptly so the confirmation screen is truthful.
 */
export const confirmBookingScheduled = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => confirmSchema.parse(input))
  .handler(async ({ data }) => {
    const { applyBookingStatus, syncBookingStatusToCrm, findBookingSession } = await import(
      "@/lib/booking/booking.server"
    );

    const existing = await findBookingSession({ sessionId: data.sessionId });
    if (!existing) return { ok: false as const };
    // The webhook may already have landed with richer detail — don't downgrade.
    if (existing.status === "scheduled" || existing.status === "rescheduled") {
      return { ok: true as const, alreadyConfirmed: true };
    }

    const row = await applyBookingStatus(data.sessionId, {
      status: "scheduled",
      calendlyEventUri: data.calendlyEventUri ?? null,
      calendlyInviteeUri: data.calendlyInviteeUri ?? null,
      timezone: data.timezone ?? null,
    });
    if (row) {
      await syncBookingStatusToCrm(row, {
        status: "scheduled",
        calendlyEventUri: data.calendlyEventUri ?? null,
        timezone: data.timezone ?? null,
      });
    }
    return { ok: true as const, alreadyConfirmed: false };
  });

const statusSchema = z.object({ sessionId: z.string().uuid() });

/**
 * Read-back for the confirmation screen: only the meeting facts the visitor
 * themselves provided or needs (time, host, join/reschedule/cancel links).
 */
export const getBookingConfirmation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => statusSchema.parse(input))
  .handler(async ({ data }) => {
    const { findBookingSession } = await import("@/lib/booking/booking.server");
    const row = await findBookingSession({ sessionId: data.sessionId });
    if (!row) return null;
    return {
      status: row.status,
      meetingType: row.meeting_type,
      scheduledStart: row.scheduled_start,
      scheduledEnd: row.scheduled_end,
      timezone: row.timezone,
      hostName: row.host_name,
      joinUrl: row.join_url,
      rescheduleUrl: row.reschedule_url,
      cancelUrl: row.cancel_url,
      email: row.email,
      firstName: row.first_name,
    };
  });

/* ------------------------------------------------ native scheduler surface -- */

const slotsSchema = z.object({
  /** Reschedules must not be blocked by their own current slot. */
  sessionId: z.string().uuid().nullable().optional(),
});

/** Open 30-minute slots across the booking horizon. Public by design. */
export const listBookingSlots = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => slotsSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { loadAvailability } = await import("@/lib/booking/native-scheduling.server");
    const availability = await loadAvailability({ excludeSessionId: data.sessionId ?? null });
    return {
      slots: availability.slots,
      hostTimezone: availability.hostTimezone,
      slotMinutes: availability.slotMinutes,
    };
  });

const bookSchema = z.object({
  sessionId: z.string().uuid(),
  start: z.string().datetime(),
  timezone: z.string().min(1).max(120),
});

/**
 * Claims a slot for an intake row. Used for both the first booking and a
 * reschedule — the server re-checks availability, so two visitors racing for
 * the same slot cannot both win.
 */
export const bookBookingSlot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => bookSchema.parse(input))
  .handler(async ({ data }) => {
    const { bookSlot } = await import("@/lib/booking/native-scheduling.server");
    const result = await bookSlot(data);
    if (!result.ok) return { ok: false as const, reason: result.reason };

    // Confirmation email + CRM note are best-effort: the booking already stands.
    try {
      const { sendBookingLifecycleEmail } = await import("@/lib/notification-email.server");
      const { fullLabel } = await import("@/lib/booking/slots");
      await sendBookingLifecycleEmail({
        to: result.email,
        firstName: result.firstName,
        kind: result.rescheduled ? "rescheduled" : "scheduled",
        when: fullLabel(result.meeting.scheduledStart, result.meeting.scheduledEnd, result.meeting.timezone),
        sessionId: result.meeting.sessionId,
        joinUrl: result.meeting.joinUrl,
        hostName: result.meeting.hostName,
      });
    } catch (err) {
      console.error("[booking] confirmation email failed", err);
    }

    try {
      const { findBookingSession, syncBookingStatusToCrm } = await import(
        "@/lib/booking/booking.server"
      );
      const row = await findBookingSession({ sessionId: data.sessionId });
      if (row) {
        await syncBookingStatusToCrm(row, {
          status: result.rescheduled ? "rescheduled" : "scheduled",
          scheduledStart: result.meeting.scheduledStart,
          scheduledEnd: result.meeting.scheduledEnd,
          timezone: result.meeting.timezone,
          hostName: result.meeting.hostName,
          joinUrl: result.meeting.joinUrl,
        });
      }
    } catch (err) {
      console.error("[booking] crm status sync failed", err);
    }

    return { ok: true as const, meeting: result.meeting };
  });

const cancelSchema = z.object({ sessionId: z.string().uuid() });

/** Cancels a booked call and frees the slot. */
export const cancelBookingSlot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => cancelSchema.parse(input))
  .handler(async ({ data }) => {
    const { cancelBooking } = await import("@/lib/booking/native-scheduling.server");
    const result = await cancelBooking(data.sessionId);
    if (!result.ok) return { ok: false as const, reason: result.reason };

    try {
      const { sendBookingLifecycleEmail } = await import("@/lib/notification-email.server");
      const { HOST } = await import("@/lib/booking/native-scheduling.server");
      await sendBookingLifecycleEmail({
        to: result.email,
        firstName: result.firstName,
        kind: "cancelled",
        when: result.scheduledStart ?? "",
        sessionId: data.sessionId,
        joinUrl: null,
        hostName: HOST.name,
      });
    } catch (err) {
      console.error("[booking] cancellation email failed", err);
    }

    // CRM mirror of the cancellation — best-effort, never blocks the cancel.
    try {
      const { findBookingSession, syncBookingStatusToCrm } = await import(
        "@/lib/booking/booking.server"
      );
      const row = await findBookingSession({ sessionId: data.sessionId });
      if (row) await syncBookingStatusToCrm(row, { status: "cancelled" });
    } catch (err) {
      console.error("[booking] crm cancel sync failed", err);
    }

    return { ok: true as const };
  });

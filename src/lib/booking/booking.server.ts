/**
 * Booking lifecycle — server only.
 *
 * Responsibilities:
 *  1. Persist every intake as a booking_sessions row (our source of truth), so
 *     a lead survives even when the visitor never picks a time.
 *  2. Mirror the lead into Attio, matching on work email + company domain so we
 *     update rather than duplicate.
 *  3. Update the same records when Calendly reports scheduled / rescheduled /
 *     cancelled — never create a second person, company, or deal.
 *
 * A CRM failure NEVER fails the visitor's booking: it is recorded on the row
 * (attio_error) and remains retryable.
 */
import { MEETING_TYPES, type MeetingTypeId } from "@/config/booking";
import { CRM_SOURCE_BRAND } from "@/lib/crm/attio-config";
import {
  createNote,
  assertPerson,
  assertCompany,
} from "@/lib/crm/attio-client.server";
import {
  normalizeDomain,
  personNameValue,
  sanitizeAnswers,
  sanitizeText,
  syncSubmissionToAttio,
  type CrmSubmission,
} from "@/lib/crm/attio-sync.server";
import {
  deriveCompanyDomain,
  intakeAnswers,
  qualificationScore,
  type BookingIntake,
} from "@/lib/booking/booking-schema";

export type BookingAttribution = Record<string, string | null>;

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function admin(): Promise<AdminClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function str(attribution: BookingAttribution, key: string): string | null {
  const value = attribution[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, 500) : null;
}

/* ------------------------------------------------------- 1. intake stored -- */

export type StoredBooking = {
  sessionId: string;
  qualificationScore: number;
};

export async function storeBookingIntake(input: {
  intake: BookingIntake;
  meetingType: MeetingTypeId;
  attribution: BookingAttribution;
}): Promise<StoredBooking> {
  const db = await admin();
  const { intake } = input;
  const score = qualificationScore(intake);
  const companyDomain = deriveCompanyDomain(intake);

  const { data, error } = await db
    .from("booking_sessions")
    .insert({
      status: "intake_submitted",
      meeting_type: input.meetingType,
      first_name: intake.firstName,
      last_name: intake.lastName,
      email: intake.email,
      phone: intake.phone,
      job_title: intake.jobTitle,
      company_name: intake.companyName,
      company_website: intake.companyWebsite,
      company_domain: companyDomain,
      company_size: intake.companySize,
      open_roles: intake.openRoles,
      hiring_volume: intake.hiringVolume,
      roles_hiring: intake.rolesHiring,
      hiring_challenge: intake.hiringChallenge,
      current_process: intake.currentProcess,
      hiring_timeline: intake.hiringTimeline,
      heard_about: intake.heardAbout,
      additional_context: intake.additionalContext,
      qualification_score: score,
      attribution: input.attribution,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`booking_session_insert_failed: ${error?.message ?? "unknown"}`);
  return { sessionId: data.id, qualificationScore: score };
}

/* ---------------------------------------------------------- 2. CRM mirror -- */

function submissionFrom(input: {
  sessionId: string;
  intake: BookingIntake;
  meetingType: MeetingTypeId;
  attribution: BookingAttribution;
  environment: "production" | "preview";
}): CrmSubmission {
  const { intake, attribution } = input;
  return {
    submission_id: input.sessionId,
    source_form_id: "book-a-call",
    submitted_at: new Date().toISOString(),
    source_page_url: str(attribution, "source_page_url"),
    source_page_title: str(attribution, "source_page_title"),
    landing_page: str(attribution, "landing_page"),
    original_referrer: str(attribution, "original_referrer"),
    latest_referrer: str(attribution, "latest_referrer"),
    utm_source: str(attribution, "utm_source"),
    utm_medium: str(attribution, "utm_medium"),
    utm_campaign: str(attribution, "utm_campaign"),
    utm_content: str(attribution, "utm_content"),
    utm_term: str(attribution, "utm_term"),
    email: intake.email,
    full_name: `${intake.firstName} ${intake.lastName}`.trim(),
    phone: intake.phone,
    job_title: intake.jobTitle,
    linkedin: null,
    company_name: intake.companyName,
    company_domain: deriveCompanyDomain(intake),
    answers: sanitizeAnswers({
      ...intakeAnswers(intake),
      "Meeting requested": MEETING_TYPES[input.meetingType].name,
      "Booking status": "Intake submitted — time not yet chosen",
      "Qualification score": String(qualificationScore(intake)),
    }),
    consent_status: "requested_call",
    consent_at: new Date().toISOString(),
    environment: input.environment,
    conversion_page: str(attribution, "conversion_page"),
    first_touch_source: str(attribution, "first_touch_source"),
    first_touch_medium: str(attribution, "first_touch_medium"),
    first_touch_campaign: str(attribution, "first_touch_campaign"),
    last_touch_source: str(attribution, "last_touch_source"),
    last_touch_medium: str(attribution, "last_touch_medium"),
    last_touch_campaign: str(attribution, "last_touch_campaign"),
    gclid: str(attribution, "gclid"),
    gbraid: str(attribution, "gbraid"),
    wbraid: str(attribution, "wbraid"),
    msclkid: str(attribution, "msclkid"),
    linkedin_click_id: str(attribution, "linkedin_click_id"),
    fgv_journey_id: str(attribution, "fgv_journey_id"),
    fgv_entry_brand: str(attribution, "fgv_entry_brand"),
    fgv_referrer: str(attribution, "fgv_referrer"),
    first_landing_timestamp: str(attribution, "first_landing_timestamp"),
    last_activity_timestamp: str(attribution, "last_activity_timestamp"),
    service_interest: "recruiting_subscription",
    secondary_service_interest: null,
    destination_brand: "taasflow",
    lead_type: "Recruiting Prospect",
    cross_sell_status: "None",
    is_test: input.environment !== "production",
  };
}

/** Best-effort CRM mirror. Records the outcome on the session; never throws. */
export async function syncBookingLeadToCrm(input: {
  sessionId: string;
  intake: BookingIntake;
  meetingType: MeetingTypeId;
  attribution: BookingAttribution;
  environment: "production" | "preview";
}): Promise<void> {
  const db = await admin();
  try {
    const ids = await syncSubmissionToAttio(submissionFrom(input));
    await db
      .from("booking_sessions")
      .update({
        attio: {
          person_id: ids.personId,
          company_id: ids.companyId,
          deal_id: ids.dealId,
          note_id: ids.noteId,
        },
        attio_synced_at: new Date().toISOString(),
        attio_error: null,
      })
      .eq("id", input.sessionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "attio_sync_failed";
    console.error("booking crm sync failed", { session_id: input.sessionId, message });
    await db
      .from("booking_sessions")
      .update({ attio_error: message.slice(0, 500) })
      .eq("id", input.sessionId);
  }
}

/* -------------------------------------------------- 3. booking status sync -- */

export type BookingStatusUpdate = {
  status: "scheduled" | "rescheduled" | "cancelled" | "completed";
  calendlyEventUri?: string | null;
  calendlyInviteeUri?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  timezone?: string | null;
  hostName?: string | null;
  hostEmail?: string | null;
  joinUrl?: string | null;
  rescheduleUrl?: string | null;
  cancelUrl?: string | null;
};

export type BookingSessionRow = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  company_website: string | null;
  company_domain: string | null;
  meeting_type: string;
  status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  timezone: string | null;
  host_name: string | null;
  join_url: string | null;
  reschedule_url: string | null;
  cancel_url: string | null;
  attio: Record<string, unknown> | null;
};

const SESSION_COLUMNS =
  "id, email, first_name, last_name, company_name, company_website, company_domain, meeting_type, status, scheduled_start, scheduled_end, timezone, host_name, join_url, reschedule_url, cancel_url, attio";

export async function findBookingSession(params: {
  sessionId?: string | null;
  calendlyEventUri?: string | null;
  calendlyInviteeUri?: string | null;
  email?: string | null;
}): Promise<BookingSessionRow | null> {
  const db = await admin();

  if (params.sessionId) {
    const { data } = await db
      .from("booking_sessions")
      .select(SESSION_COLUMNS)
      .eq("id", params.sessionId)
      .maybeSingle();
    if (data) return data as BookingSessionRow;
  }
  if (params.calendlyInviteeUri) {
    const { data } = await db
      .from("booking_sessions")
      .select(SESSION_COLUMNS)
      .eq("calendly_invitee_uri", params.calendlyInviteeUri)
      .maybeSingle();
    if (data) return data as BookingSessionRow;
  }
  if (params.calendlyEventUri) {
    const { data } = await db
      .from("booking_sessions")
      .select(SESSION_COLUMNS)
      .eq("calendly_event_uri", params.calendlyEventUri)
      .maybeSingle();
    if (data) return data as BookingSessionRow;
  }
  if (params.email) {
    // Latest intake from this email that has no meeting attached yet.
    const { data } = await db
      .from("booking_sessions")
      .select(SESSION_COLUMNS)
      .eq("email", params.email.toLowerCase())
      .is("calendly_event_uri", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as BookingSessionRow;
  }
  return null;
}

/** Applies a confirmed scheduling outcome to our row. */
export async function applyBookingStatus(
  sessionId: string,
  update: BookingStatusUpdate,
): Promise<BookingSessionRow | null> {
  const db = await admin();
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = { status: update.status };
  if (update.calendlyEventUri !== undefined) patch["calendly_event_uri"] = update.calendlyEventUri;
  if (update.calendlyInviteeUri !== undefined) {
    patch["calendly_invitee_uri"] = update.calendlyInviteeUri;
  }
  if (update.scheduledStart !== undefined) patch["scheduled_start"] = update.scheduledStart;
  if (update.scheduledEnd !== undefined) patch["scheduled_end"] = update.scheduledEnd;
  if (update.timezone !== undefined) patch["timezone"] = update.timezone;
  if (update.hostName !== undefined) patch["host_name"] = update.hostName;
  if (update.hostEmail !== undefined) patch["host_email"] = update.hostEmail;
  if (update.joinUrl !== undefined) patch["join_url"] = update.joinUrl;
  if (update.rescheduleUrl !== undefined) patch["reschedule_url"] = update.rescheduleUrl;
  if (update.cancelUrl !== undefined) patch["cancel_url"] = update.cancelUrl;
  if (update.status === "scheduled" || update.status === "rescheduled") patch["scheduled_at"] = now;
  if (update.status === "cancelled") patch["cancelled_at"] = now;

  const { data, error } = await db
    .from("booking_sessions")
    .update(patch as never)
    .eq("id", sessionId)
    .select(SESSION_COLUMNS)
    .maybeSingle();


  if (error) {
    console.error("booking status update failed", { session_id: sessionId, message: error.message });
    return null;
  }
  return (data as BookingSessionRow | null) ?? null;
}

const STATUS_LABEL: Record<BookingStatusUpdate["status"], string> = {
  scheduled: "Meeting scheduled",
  rescheduled: "Meeting rescheduled",
  cancelled: "Meeting cancelled",
  completed: "Meeting completed",
};

/**
 * Mirrors a native-scheduler outcome (scheduled / rescheduled / cancelled) into
 * Attio: upsert the Person on email, upsert the Company on domain and link it,
 * then record the meeting as a Note on the Person — the same shape the intake
 * mirror uses, so we never create a duplicate person, company, or deal.
 *
 * Non-blocking by contract: every failure lands in attio_error and the booking
 * itself still stands.
 */
export async function syncBookingStatusToCrm(
  row: BookingSessionRow,
  update: BookingStatusUpdate,
): Promise<void> {
  const db = await admin();
  const meeting = MEETING_TYPES[(row.meeting_type as MeetingTypeId) ?? "discovery"];

  const lines = [
    `Status: ${STATUS_LABEL[update.status]}`,
    `Meeting: ${meeting?.name ?? row.meeting_type}`,
    update.scheduledStart ?? row.scheduled_start
      ? `When: ${update.scheduledStart ?? row.scheduled_start}`
      : null,
    update.scheduledEnd ? `Until: ${update.scheduledEnd}` : null,
    update.timezone ?? row.timezone ? `Timezone: ${update.timezone ?? row.timezone}` : null,
    update.hostName ?? row.host_name ? `Host: ${update.hostName ?? row.host_name}` : null,
    update.joinUrl ?? row.join_url ? `Join: ${update.joinUrl ?? row.join_url}` : null,
    row.company_name ? `Company: ${row.company_name}` : null,
    update.calendlyEventUri ? `Calendly event: ${update.calendlyEventUri}` : null,
    update.rescheduleUrl ? `Reschedule: ${update.rescheduleUrl}` : null,
    update.cancelUrl ? `Cancel: ${update.cancelUrl}` : null,
    `Booking session: ${row.id}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    if (!process.env["ATTIO_API_KEY"]) throw new Error("ATTIO_API_KEY is not configured");

    const existing = (row.attio ?? {}) as Record<string, unknown>;
    const fullName = `${row.first_name} ${row.last_name}`.trim();

    // Person — upsert on email, so a booking without a prior mirror still lands.
    const personId = await assertPerson({
      email_addresses: [row.email],
      name: personNameValue(fullName),
    });

    // Company — upsert on domain, then link the person to it.
    const domain =
      normalizeDomain(row.company_domain) ?? normalizeDomain(row.company_website) ?? null;
    let companyId = (existing["company_id"] as string | undefined) ?? null;
    if (domain) {
      try {
        companyId = await assertCompany({
          domains: [domain],
          name: row.company_name ?? undefined,
        });
        await assertPerson({ email_addresses: [row.email], company: companyId });
      } catch (companyError) {
        // A renamed/locked company attribute must not lose the meeting note.
        console.error("booking crm company link failed", {
          session_id: row.id,
          message: companyError instanceof Error ? companyError.message : "unknown",
        });
      }
    }

    const noteId = await createNote({
      parentObject: "people",
      parentRecordId: personId,
      title: `${CRM_SOURCE_BRAND} | ${STATUS_LABEL[update.status]}`,
      content: sanitizeText(lines, 4000),
    });

    await db
      .from("booking_sessions")
      .update({
        attio: {
          ...existing,
          person_id: personId,
          company_id: companyId,
          last_status_note_id: noteId,
          last_status: update.status,
        },
        attio_synced_at: new Date().toISOString(),
        attio_error: null,
      })
      .eq("id", row.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "attio_status_sync_failed";
    console.error("booking status crm sync failed", { session_id: row.id, message });
    await db
      .from("booking_sessions")
      .update({ attio_error: message.slice(0, 500) })
      .eq("id", row.id);
  }
}


/** Idempotency gate for scheduling webhooks. True when this is a fresh event. */
export async function recordWebhookEvent(params: {
  id: string;
  eventType: string;
  sessionId: string | null;
  payload: unknown;
}): Promise<boolean> {
  const db = await admin();
  const { error } = await db.from("calendly_webhook_events").insert({
    id: params.id,
    event_type: params.eventType,
    booking_session_id: params.sessionId,
    payload: (params.payload ?? {}) as never,
  });
  // Duplicate primary key = we already applied this event.
  if (error) return false;
  return true;
}

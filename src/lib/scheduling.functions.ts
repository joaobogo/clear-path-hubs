// Scheduling coordination surface: candidate responses, org scheduling
// configuration, and canonical interview status history.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { isValidTimezone } from "./scheduling";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

/** Interviews the signed-in candidate is a party to. Contact-safe fields only. */
export const listMyInterviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("candidate_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile) return { items: [] };

    const { data: matches } = await context.supabase
      .from("candidate_matches")
      .select("id, application_id")
      .eq("candidate_profile_id", (profile as AnyRow).id);
    const ids = ((matches as AnyRow[]) ?? []).map((m) => m.id as string);
    if (!ids.length) return { items: [] };
    const appByMatch = new Map(
      ((matches as AnyRow[]) ?? []).map((m) => [m.id as string, m.application_id as string | null]),
    );

    const { data, error } = await context.supabase
      .from("interviews")
      .select(
        "id, candidate_match_id, status, interview_type, scheduled_at, timezone, duration_minutes, meeting_url, location, proposed_times, participants, availability_expires_at, candidate_response, candidate_selected_time, confirmed_at, admin_coordination_required, calendly_url, scheduling_method, positions:position_id(title)",
      )
      .in("candidate_match_id", ids)
      .order("scheduled_at", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);

    return {
      items: ((data as AnyRow[]) ?? []).map((r) => ({
        id: r.id as string,
        application_id: appByMatch.get(r.candidate_match_id as string) ?? null,
        status: r.status as string,
        interview_type: r.interview_type as string,
        scheduled_at: r.scheduled_at as string | null,
        timezone: (r.timezone as string | null) ?? "UTC",
        duration_minutes: (r.duration_minutes as number | null) ?? 60,
        meeting_url: (r.meeting_url as string | null) ?? null,
        location: (r.location as string | null) ?? null,
        proposed_times: (r.proposed_times as string[] | null) ?? [],
        // Interviewers are described by role only — never by name or email.
        participant_roles: (Array.isArray(r.participants) ? r.participants : [])
          .map((p: AnyRow) => (typeof p?.role === "string" ? p.role : ""))
          .filter((role: string) => role.trim().length > 0),
        // Names are released only once the interview is actually scheduled —
        // that is the point at which the candidate needs to know who to meet.
        participant_people: (Array.isArray(r.participants) ? r.participants : [])
          .map((p: AnyRow) => ({
            role: typeof p?.role === "string" && p.role.trim() ? (p.role as string) : null,
            name:
              r.status === "scheduled" && typeof p?.name === "string" && p.name.trim()
                ? (p.name as string)
                : null,
          }))
          .filter((p: { role: string | null; name: string | null }) => p.role || p.name),
        availability_expires_at: (r.availability_expires_at as string | null) ?? null,
        candidate_response:
          (r.candidate_response as string | null) === "pending"
            ? null
            : ((r.candidate_response as string | null) ?? null),
        candidate_selected_time: (r.candidate_selected_time as string | null) ?? null,
        confirmed_at: (r.confirmed_at as string | null) ?? null,
        awaiting_confirmation: Boolean(r.admin_coordination_required) && !r.confirmed_at,
        calendly_url: (r.calendly_url as string | null) ?? null,
        scheduling_method: (r.scheduling_method as string | null) ?? "manual",
        position_title: (r.positions?.title as string) ?? "Position",
      })),
    };
  });


/**
 * Candidate replies to a proposed time. Accepting releases the other slots and
 * schedules the chosen one, unless the organisation coordinates manually — then
 * the time is held and confirmed by a coordinator, so the candidate is never
 * shown a booking that was not actually made.
 */

export const respondToInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        interviewId: z.string().uuid(),
        response: z.enum(["accepted", "declined", "reschedule_requested"]),
        preferredTime: z.string().datetime().optional(),
        note: z.string().max(1000).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { data: profile } = await context.supabase
      .from("candidate_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile) throw new Error("Forbidden");

    const { data: iv } = await context.supabase
      .from("interviews")
      .select(
        "id, organization_id, candidate_match_id, status, proposed_times, availability_expires_at, admin_coordination_required",
      )
      .eq("id", data.interviewId)
      .maybeSingle();
    if (!iv) throw new Error("not_found");

    const { data: match } = await context.supabase
      .from("candidate_matches")
      .select("id")
      .eq("id", (iv as AnyRow).candidate_match_id)
      .eq("candidate_profile_id", (profile as AnyRow).id)
      .maybeSingle();
    if (!match) throw new Error("Forbidden");

    if (["cancelled", "completed"].includes((iv as AnyRow).status)) {
      throw new Error("interview_closed");
    }
    const expiry = (iv as AnyRow).availability_expires_at as string | null;
    if (expiry && new Date(expiry).getTime() < Date.now()) {
      throw new Error("availability_expired");
    }
    if (data.preferredTime) {
      const slots = ((iv as AnyRow).proposed_times as string[] | null) ?? [];
      if (!slots.includes(data.preferredTime)) throw new Error("slot_not_offered");
      if (new Date(data.preferredTime).getTime() < Date.now()) throw new Error("slot_in_past");
    }

    // Accepting a slot releases the others: the accepted time becomes the only
    // one still held. When the organisation coordinates manually the time is
    // held rather than confirmed, so the candidate is never shown a booking
    // that has not actually been made.
    const accepting = data.response === "accepted" && Boolean(data.preferredTime);
    const coordinationRequired = Boolean((iv as AnyRow).admin_coordination_required);
    const now = new Date().toISOString();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("interviews")
      .update({
        candidate_response: data.response,
        candidate_response_at: now,
        candidate_selected_time: data.preferredTime ?? null,
        candidate_note: data.note ?? null,
        ...(accepting
          ? {
              proposed_times: [data.preferredTime] as never,
              scheduled_at: data.preferredTime as never,
              ...(coordinationRequired
                ? { status: "scheduling" as never }
                : { status: "scheduled" as never, confirmed_at: now }),
            }
          : {
              // Declining or asking for a new time un-books whatever was held:
              // the candidate must never keep seeing a confirmed interview they
              // just said no to.
              scheduled_at: null as never,
              confirmed_at: null as never,
              status:
                (iv as AnyRow).status === "completed" ? (iv as AnyRow).status : ("scheduling" as never),
            }),

      })
      .eq("id", data.interviewId);

    if (error) throw new Error(error.message);

    // Coordinators get one notification per distinct response.
    try {
      const { emitInterviewEvent } = await import("./interview-events.server");
      await emitInterviewEvent({
        interviewId: data.interviewId,
        event: "interview_requested",
        actorUserId: context.userId,
        scopeSuffix: `response:${data.response}:${data.preferredTime ?? "none"}`,
      });
    } catch (e) {
      console.error("[respondToInterview] emit failed", e);
    }

    return { ok: true };
  });

/** Canonical status history for one interview, for any authorized viewer. */
export const getInterviewHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ interviewId: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    // RLS on interviews decides visibility; history is keyed off that read.
    const { data: iv } = await context.supabase
      .from("interviews")
      .select("id")
      .eq("id", data.interviewId)
      .maybeSingle();
    if (!iv) return { items: [] };
    const { data: rows, error } = await context.supabase
      .from("interview_status_history")
      .select("id, from_status, to_status, created_at, reason, scheduled_at")
      .eq("interview_id", data.interviewId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { items: (rows as AnyRow[]) ?? [] };
  });

export const getSchedulingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ orgId: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("org_scheduling_settings")
      .select(
        "organization_id, scheduling_method, calendly_url, default_timezone, availability_window_days, require_admin_coordination",
      )
      .eq("organization_id", data.orgId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      settings:
        (row as AnyRow) ?? {
          organization_id: data.orgId,
          scheduling_method: "manual",
          calendly_url: null,
          default_timezone: "UTC",
          availability_window_days: 14,
          require_admin_coordination: true,
        },

    };
  });

export const saveSchedulingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        orgId: z.string().uuid(),
        schedulingMethod: z.enum(["manual", "calendly"]),
        calendlyUrl: z
          .string()
          .trim()
          .url()
          .max(500)
          .refine((u) => u.startsWith("https://calendly.com/"), "must_be_calendly_url")
          .nullable()
          .optional(),
        defaultTimezone: z.string().min(1).max(80).optional(),
        availabilityWindowDays: z.number().int().min(1).max(90),
        requireAdminCoordination: z.boolean(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    if (data.defaultTimezone && !isValidTimezone(data.defaultTimezone)) {
      throw new Error("invalid_timezone");
    }
    // Calendly can only be selected when a real URL is configured.
    if (data.schedulingMethod === "calendly" && !data.calendlyUrl) {
      throw new Error("calendly_url_required");
    }
    const { data: canEdit } = await context.supabase.rpc("is_org_editor", {
      _user: context.userId,
      _org: data.orgId,
    });
    if (!canEdit) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("org_scheduling_settings").upsert(
      {
        organization_id: data.orgId,
        scheduling_method: data.schedulingMethod,
        calendly_url: data.calendlyUrl ?? null,
        default_timezone: data.defaultTimezone ?? "UTC",

        availability_window_days: data.availabilityWindowDays,
        require_admin_coordination: data.requireAdminCoordination,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      },
      { onConflict: "organization_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Candidate reschedules or cancels a booked interview without an email thread.
 *
 * Available until the interview start time. A request inside twenty-four hours
 * is permitted — the notice about timing is shown in the UI, never enforced
 * here. Reschedule releases the booked time and asks for new options; cancel
 * releases it and closes the interview. The candidate's application is not
 * touched either way, and no reason is required.
 */
export const requestInterviewChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        interviewId: z.string().uuid(),
        action: z.enum(["reschedule", "cancel"]),
        note: z.string().max(1000).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { data: profile } = await context.supabase
      .from("candidate_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile) throw new Error("Forbidden");

    const { data: iv } = await context.supabase
      .from("interviews")
      .select("id, candidate_match_id, status, scheduled_at, reschedule_count")
      .eq("id", data.interviewId)
      .maybeSingle();
    if (!iv) throw new Error("not_found");

    const { data: match } = await context.supabase
      .from("candidate_matches")
      .select("id")
      .eq("id", (iv as AnyRow).candidate_match_id)
      .eq("candidate_profile_id", (profile as AnyRow).id)
      .maybeSingle();
    if (!match) throw new Error("Forbidden");

    if (["cancelled", "completed"].includes((iv as AnyRow).status)) {
      throw new Error("interview_closed");
    }
    const scheduledAt = (iv as AnyRow).scheduled_at as string | null;
    if (!scheduledAt) throw new Error("not_scheduled");
    if (new Date(scheduledAt).getTime() <= Date.now()) throw new Error("interview_started");

    const now = new Date().toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch =
      data.action === "reschedule"
        ? {
            status: "scheduling" as never,
            candidate_response: "reschedule_requested",
            candidate_response_at: now,
            candidate_note: data.note ?? null,
            candidate_selected_time: null,
            previous_scheduled_at: scheduledAt,
            scheduled_at: null,
            confirmed_at: null,
            proposed_times: [] as never,
            availability_expires_at: null,
            reschedule_count: (((iv as AnyRow).reschedule_count as number) ?? 0) + 1,
          }
        : {
            status: "cancelled" as never,
            candidate_response: "declined",
            candidate_response_at: now,
            candidate_note: data.note ?? null,
            previous_scheduled_at: scheduledAt,
            cancelled_at: now,
            cancel_reason: "Cancelled by candidate",
          };

    const { error } = await supabaseAdmin
      .from("interviews")
      .update(patch)
      .eq("id", data.interviewId);
    if (error) throw new Error(error.message);

    try {
      const { emitInterviewEvent } = await import("./interview-events.server");
      await emitInterviewEvent({
        interviewId: data.interviewId,
        event: data.action === "reschedule" ? "interview_requested" : "interview_cancelled",
        actorUserId: context.userId,
        scopeSuffix: `candidate_change:${data.action}:${now}`,
      });
    } catch (e) {
      console.error("[requestInterviewChange] emit failed", e);
    }

    return { ok: true, action: data.action, at: now };
  });

// Availability windows + one-tap reschedule.
// A client stores weekly windows once; proposals are generated from them.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { isValidTimezone } from "./scheduling";
import { generateSlots, type AvailabilityWindow } from "./availability";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const trace = () =>
  `av_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

async function assertEditor(supabase: AnyRow, userId: string, orgId: string) {
  const { data: m, error } = await supabase
    .from("memberships")
    .select("role, status")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const role = (m as AnyRow)?.role as string | undefined;
  const allowed = new Set(["client_admin", "client_editor", "platform_admin", "operations"]);
  if (!role || !allowed.has(role)) throw new Error("forbidden");
  const { data: session } = await supabase
    .from("support_sessions")
    .select("mode, expires_at, ended_at")
    .eq("actor_user_id", userId)
    .eq("target_organization_id", orgId)
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (session && (session as AnyRow).mode !== "interactive") {
    throw new Error("SUPPORT_VIEW_READ_ONLY");
  }
}

const windowSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  start_minute: z.number().int().min(0).max(1439),
  end_minute: z.number().int().min(1).max(1440),
});

export const getAvailabilityWindows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) =>
    z.object({ orgId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("org_availability_windows")
      .select("id, weekday, start_minute, end_minute, timezone")
      .eq("organization_id", data.orgId)
      .order("weekday", { ascending: true })
      .order("start_minute", { ascending: true });
    if (error) throw new Error(error.message);
    const windows = (rows ?? []) as AvailabilityWindow[];
    return {
      windows,
      timezone: windows[0]?.timezone ?? null,
    };
  });

export const saveAvailabilityWindows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { orgId: string; timezone: string; windows: unknown[] }) =>
      z
        .object({
          orgId: z.string().uuid(),
          timezone: z.string().min(1).max(80),
          windows: z.array(windowSchema).max(40),
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    const t = trace();
    await assertEditor(context.supabase, context.userId, data.orgId);
    if (!isValidTimezone(data.timezone)) throw new Error("invalid_timezone");
    for (const w of data.windows) {
      if (w.end_minute <= w.start_minute) throw new Error("invalid_window_range");
    }

    const { error: delErr } = await context.supabase
      .from("org_availability_windows")
      .delete()
      .eq("organization_id", data.orgId);
    if (delErr) throw new Error(delErr.message);

    if (data.windows.length > 0) {
      // De-duplicate identical rows so the unique constraint can't reject a save.
      const seen = new Set<string>();
      const rows = data.windows
        .filter((w) => {
          const key = `${w.weekday}:${w.start_minute}:${w.end_minute}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((w) => ({
          organization_id: data.orgId,
          weekday: w.weekday,
          start_minute: w.start_minute,
          end_minute: w.end_minute,
          timezone: data.timezone,
          created_by: context.userId,
        }));
      const { error } = await context.supabase.from("org_availability_windows").insert(rows as never);
      if (error) throw new Error(error.message);
    }

    await context.supabase.from("audit_events").insert({
      actor_user_id: context.userId,
      action: "availability.saved",
      entity_type: "org_availability_windows",
      entity_id: data.orgId,
      organization_id: data.orgId,
      after_state: { timezone: data.timezone, count: data.windows.length } as never,
      trace_id: t,
    });
    return { ok: true, trace_id: t, count: data.windows.length };
  });

async function loadInterview(supabase: AnyRow, orgId: string, id: string) {
  const { data, error } = await supabase
    .from("interviews")
    .select("*")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("interview_not_found");
  return data as AnyRow;
}

async function windowsFor(supabase: AnyRow, orgId: string) {
  const { data, error } = await supabase
    .from("org_availability_windows")
    .select("weekday, start_minute, end_minute, timezone")
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  return (data ?? []) as AvailabilityWindow[];
}

/** Propose times generated from the org's saved availability windows. */
export const proposeFromAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { orgId: string; id: string; durationMinutes?: number }) =>
      z
        .object({
          orgId: z.string().uuid(),
          id: z.string().uuid(),
          durationMinutes: z.number().int().min(15).max(480).optional(),
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    const t = trace();
    await assertEditor(context.supabase, context.userId, data.orgId);
    const prev = await loadInterview(context.supabase, data.orgId, data.id);
    if (!["requested", "scheduling"].includes(prev.status)) {
      throw new Error(`invalid_transition:${prev.status}->scheduling`);
    }
    const windows = await windowsFor(context.supabase, data.orgId);
    if (windows.length === 0) throw new Error("no_availability_windows");
    const timezone = windows[0].timezone || "UTC";
    const duration = data.durationMinutes ?? Number(prev.duration_minutes ?? 60);
    const slots = generateSlots({ windows, timezone, durationMinutes: duration });
    if (slots.length === 0) throw new Error("no_slots_available");

    const { error } = await context.supabase
      .from("interviews")
      .update({
        status: "scheduling",
        proposed_times: slots as never,
        timezone,
        duration_minutes: duration,
        availability_expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
        updated_by: context.userId,
      })
      .eq("id", data.id)
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);

    await context.supabase.from("audit_events").insert({
      actor_user_id: context.userId,
      action: "interview.proposed_from_availability",
      entity_type: "interviews",
      entity_id: data.id,
      organization_id: data.orgId,
      before_state: { status: prev.status } as never,
      after_state: { status: "scheduling", proposed_times: slots } as never,
      trace_id: t,
    });

    try {
      const { emitInterviewEvent } = await import("./interview-events.server");
      await emitInterviewEvent({
        interviewId: data.id,
        event: "interview_requested",
        actorUserId: context.userId,
        scopeSuffix: `slots:${slots[0]}`,
      });
    } catch (e) {
      console.error("[proposeFromAvailability] emit failed", t, e);
    }
    return { ok: true, trace_id: t, slots };
  });

/**
 * One tap: reopen a scheduled interview for new times and notify both sides.
 * Keeps the previous time for reference and increments the reschedule counter.
 */
export const rescheduleInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { orgId: string; id: string; reason?: string }) =>
      z
        .object({
          orgId: z.string().uuid(),
          id: z.string().uuid(),
          reason: z.string().max(500).optional(),
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    const t = trace();
    await assertEditor(context.supabase, context.userId, data.orgId);
    const prev = await loadInterview(context.supabase, data.orgId, data.id);
    if (!["scheduled", "scheduling"].includes(prev.status)) {
      throw new Error(`invalid_transition:${prev.status}->scheduling`);
    }

    const windows = await windowsFor(context.supabase, data.orgId);
    const timezone = windows[0]?.timezone || (prev.timezone as string) || "UTC";
    const duration = Number(prev.duration_minutes ?? 60);
    const slots =
      windows.length > 0
        ? generateSlots({ windows, timezone, durationMinutes: duration })
        : [];

    const { error } = await context.supabase
      .from("interviews")
      .update({
        status: "scheduling",
        previous_scheduled_at: prev.scheduled_at ?? null,
        scheduled_at: null,
        proposed_times: slots as never,
        candidate_response: null as never,
        candidate_response_at: null,
        candidate_selected_time: null,
        availability_expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
        reschedule_count: Number(prev.reschedule_count ?? 0) + 1,
        timezone,
        notes: data.reason
          ? `${prev.notes ? `${prev.notes}\n` : ""}Reschedule: ${data.reason}`
          : (prev.notes ?? null),
        updated_by: context.userId,
      })
      .eq("id", data.id)
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);

    await context.supabase.from("audit_events").insert({
      actor_user_id: context.userId,
      action: "interview.reschedule_started",
      entity_type: "interviews",
      entity_id: data.id,
      organization_id: data.orgId,
      before_state: { status: prev.status, scheduled_at: prev.scheduled_at } as never,
      after_state: { status: "scheduling", proposed_times: slots } as never,
      trace_id: t,
    });

    try {
      const { emitInterviewEvent } = await import("./interview-events.server");
      await emitInterviewEvent({
        interviewId: data.id,
        event: "interview_rescheduled",
        actorUserId: context.userId,
        scopeSuffix: `${prev.scheduled_at ?? "none"}:${Date.now()}`,
      });
    } catch (e) {
      console.error("[rescheduleInterview] emit failed", t, e);
    }
    return { ok: true, trace_id: t, slots, hasWindows: windows.length > 0 };
  });

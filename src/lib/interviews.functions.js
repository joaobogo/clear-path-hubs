// Interview service — canonical server functions for the Client interviews
// workspace. Every action is tenant-scoped via requireSupabaseAuth + explicit
// organization_id checks. Client Viewers and read-only Admin support views are
// denied mutation paths.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { parseStoredPreference, } from "@/lib/candidate/availability-preference";
import { isValidTimezone } from "./scheduling";
import { assertProposedSlots, isEmail } from "./interview-proposal";
import { assertWorkspaceAccess } from "@/lib/authz/workspace-access";
import { assertEditor } from "@/lib/client-shared.server";
import { resolveNotificationsForUser } from "@/lib/notifications-resolver.server";
const traceId = () => `iv_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
const INTERVIEW_TYPES = [
    "phone_screen",
    "video_call",
    "onsite",
    "technical",
    "panel",
    "final",
    "other",
];
const participantSchema = z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(255).optional(),
    role: z.string().trim().max(80).optional(),
});
// ─── Guards ─────────────────────────────────────────────────────────────────
async function loadMatch(supabase, orgId, matchId) {
    const { data, error } = await supabase
        .from("candidate_matches")
        .select("id, organization_id, position_id, application_id, stage, client_visibility")
        .eq("id", matchId)
        .eq("organization_id", orgId)
        .maybeSingle();
    if (error)
        throw new Error(error.message);
    if (!data)
        throw new Error("match_not_found");
    if (data.client_visibility !== "visible")
        throw new Error("match_not_visible");
    return data;
}
async function loadInterview(supabase, orgId, id) {
    const { data, error } = await supabase
        .from("interviews")
        .select("*")
        .eq("id", id)
        .eq("organization_id", orgId)
        .maybeSingle();
    if (error)
        throw new Error(error.message);
    if (!data)
        throw new Error("interview_not_found");
    return data;
}
async function writeAudit(supabase, opts) {
    await supabase.from("audit_events").insert({
        actor_user_id: opts.actor,
        action: opts.action,
        entity_type: "interviews",
        entity_id: opts.entity_id,
        organization_id: opts.organization_id,
        before_state: (opts.before ?? null),
        after_state: (opts.after ?? null),
        trace_id: opts.trace_id,
    });
}
function toDTO(row, candidate, position) {
    const status = row.status;
    const stage = candidate?.stage;
    // ELIGIBILITY PREDICATE: An interview request is actionable only if:
    // 1. The match is in an interview-ready stage.
    // 2. The match doesn't have another scheduled interview (checked in confirmation).
    const isEligible = ["delivered", "shortlisted", "interview_process"].includes(stage || "");
    const nextAction = status === "requested"
        ? isEligible ? "Propose interview times" : "Move to interview stage to propose"
        : status === "scheduling"
            ? "Confirm a scheduled time"
            : status === "scheduled"
                ? "Mark completed after interview"
                : status === "completed"
                    ? "Add feedback or close"
                    : "Archived";
    return {
        id: row.id,
        organization_id: row.organization_id,
        position_id: row.position_id,
        candidate_match_id: row.candidate_match_id,
        candidate_submission_id: row.candidate_submission_id ?? null,
        status,
        interview_type: (row.interview_type ?? null),
        scheduled_at: row.scheduled_at ?? null,
        duration_minutes: row.duration_minutes ?? null,
        timezone: row.timezone ?? null,
        meeting_url: row.meeting_url ?? null,
        location: row.location ?? null,
        proposed_times: Array.isArray(row.proposed_times) ? row.proposed_times : [],
        participants: Array.isArray(row.participants) ? row.participants : [],
        notes: row.notes ?? null,
        feedback: row.feedback ?? null,
        cancel_reason: row.cancel_reason ?? null,
        requested_at: row.requested_at,
        completed_at: row.completed_at ?? null,
        cancelled_at: row.cancelled_at ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        next_action: nextAction,
        candidate_response: row.candidate_response ?? null,
        candidate_response_at: row.candidate_response_at ?? null,
        candidate_selected_time: row.candidate_selected_time ?? null,
        candidate_note: row.candidate_note ?? null,
        availability_expires_at: row.availability_expires_at ?? null,
        reschedule_count: Number(row.reschedule_count ?? 0),
        scheduling_method: row.scheduling_method ?? "manual",
        calendly_url: row.calendly_url ?? null,
        candidate: candidate
            ? {
                id: candidate.id,
                name: candidate.full_name ?? "Candidate",
                email: candidate.email ?? null,
            }
            : null,
        position: position
            ? {
                id: position.id,
                title: position.title ?? "Position",
                reference: position.reference_code ?? null,
            }
            : null,
    };
}
export const listClientInterviews = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input) => z
    .object({
    orgId: z.string().uuid(),
    status: z
        .enum(["all", "requested", "scheduling", "scheduled", "completed", "cancelled"])
        .optional(),
})
    .parse(input))
    .handler(async ({ context, data }) => {
    await assertWorkspaceAccess(context.supabase, context.userId, data.orgId);
    let q = context.supabase
        .from("interviews")
        .select("*")
        .eq("organization_id", data.orgId)
        .order("scheduled_at", { ascending: true, nullsFirst: false })
        .order("requested_at", { ascending: false });
    if (data.status && data.status !== "all")
        q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error)
        throw new Error(error.message);
    const list = rows ?? [];
    if (list.length === 0)
        return { interviews: [] };
    const matchIds = Array.from(new Set(list.map((r) => r.candidate_match_id).filter(Boolean)));
    const positionIds = Array.from(new Set(list.map((r) => r.position_id).filter(Boolean)));
    const [matchesRes, positionsRes] = await Promise.all([
        context.supabase
            .from("candidate_matches")
            .select("id, candidate_profile_id, candidate_profiles:candidate_profile_id(id, full_name, email, availability)")
            .in("id", matchIds),
        context.supabase
            .from("positions")
            .select("id, title, reference_code")
            .in("id", positionIds),
    ]);
    // Employer roles hold no RLS read on candidate_profiles, so the embed comes
    // back null and every card would degrade to "Candidate". Fill the already
    // authorized rows through the shared hydration helper (no contact fields).
    const { hydrateClientCandidateProfiles } = await import("@/lib/client-candidate-hydrate.server");
    const hydratedMatches = await hydrateClientCandidateProfiles(matchesRes.data ?? []);
    const matchMap = new Map();
    for (const m of hydratedMatches) {
        const cp = m.candidate_profiles;
        matchMap.set(m.id, cp ?? null);
    }
    const posMap = new Map();
    for (const p of (positionsRes.data ?? []))
        posMap.set(p.id, p);
    return {
        interviews: list.map((r) => {
            const match = hydratedMatches.find((m) => m.id === r.candidate_match_id);
            return toDTO(r, match ? { ...matchMap.get(r.candidate_match_id), stage: match.stage } : null, posMap.get(r.position_id) ?? null);
        }),
    };
});
// ─── Mutations ──────────────────────────────────────────────────────────────
const proposedTimesSchema = z
    .array(z.string().datetime())
    .min(1)
    .max(10);
export const requestInterview = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input) => z
    .object({
    orgId: z.string().uuid(),
    matchId: z.string().uuid(),
    interviewType: z.enum(INTERVIEW_TYPES),
    timezone: z.string().min(1).max(80),
    durationMinutes: z.number().int().min(15).max(480),
    proposedTimes: proposedTimesSchema,
    participants: z.array(participantSchema).min(1).max(10),
    notes: z.string().max(4000).optional(),
})
    .parse(input))
    .handler(async ({ context, data }) => {
    const trace = traceId();
    await assertEditor(context.supabase, context.userId, data.orgId);
    const match = await loadMatch(context.supabase, data.orgId, data.matchId);
    if (!isValidTimezone(data.timezone))
        throw new Error("invalid_timezone");
    // Two or three future slots, none inside 24 hours, no duplicates — a
    // proposal that can't be worked is never accepted.
    const now = Date.now();
    const times = assertProposedSlots(data.proposedTimes, now);
    for (const p of data.participants) {
        if (p.email && !isEmail(p.email))
            throw new Error("invalid_attendee_email");
    }
    const { data: existing } = await context.supabase
        .from("interviews")
        .select("id")
        .eq("candidate_match_id", data.matchId)
        .in("status", ["requested", "scheduling", "scheduled"])
        .maybeSingle();
    if (existing)
        throw new Error("interview_already_active");
    // Real configured scheduling settings only — no invented Calendly links.
    const { data: settings } = await context.supabase
        .from("org_scheduling_settings")
        .select("scheduling_method, calendly_url, require_admin_coordination, availability_window_days")
        .eq("organization_id", data.orgId)
        .maybeSingle();
    const s = settings ?? null;
    const method = s?.calendly_url && s?.scheduling_method === "calendly" ? "calendly" : "manual";
    const windowDays = Math.max(1, Number(s?.availability_window_days ?? 14));
    // Availability expires at the last proposed slot or the configured window,
    // whichever comes first — expired requests stop being actionable.
    const lastSlot = new Date(times[times.length - 1]).getTime();
    const windowEnd = now + windowDays * 86400000;
    const expiresAt = new Date(Math.min(lastSlot, windowEnd)).toISOString();
    const { data: inserted, error } = await context.supabase
        .from("interviews")
        .insert({
        candidate_match_id: data.matchId,
        organization_id: data.orgId,
        position_id: match.position_id,
        candidate_submission_id: match.application_id ?? null,
        status: "requested",
        interview_type: data.interviewType,
        timezone: data.timezone,
        duration_minutes: data.durationMinutes,
        proposed_times: times,
        participants: data.participants,
        notes: data.notes ?? null,
        requested_at: new Date().toISOString(),
        requested_by_user_id: context.userId,
        scheduling_method: method,
        calendly_url: method === "calendly" ? s.calendly_url : null,
        availability_expires_at: expiresAt,
        admin_coordination_required: s?.require_admin_coordination ?? true,
        created_by: context.userId,
        updated_by: context.userId,
    })
        .select("id")
        .maybeSingle();
    if (error) {
        if (error.code === "23505")
            throw new Error("interview_already_active");
        throw new Error(error.message);
    }
    await writeAudit(context.supabase, {
        actor: context.userId,
        action: "interview.requested",
        entity_id: inserted.id,
        organization_id: data.orgId,
        after: { status: "requested", type: data.interviewType },
        trace_id: trace,
    });
    try {
        const { emitInterviewEvent } = await import("./interview-events.server");
        await emitInterviewEvent({
            interviewId: inserted.id,
            event: "interview_requested",
            actorUserId: context.userId,
        });
    }
    catch (e) {
        console.error("[requestInterview] emit failed", trace, e);
    }
    return { ok: true, id: inserted.id, trace_id: trace };
});
export const proposeInterviewTimes = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input) => z
    .object({
    orgId: z.string().uuid(),
    id: z.string().uuid(),
    proposedTimes: proposedTimesSchema,
    interviewType: z.enum(INTERVIEW_TYPES).optional(),
    timezone: z.string().min(1).max(80).optional(),
    durationMinutes: z.number().int().min(15).max(480).optional(),
    participants: z.array(participantSchema).min(1).max(10).optional(),
    notes: z.string().max(4000).optional(),
})
    .parse(input))
    .handler(async ({ context, data }) => {
    const trace = traceId();
    await assertEditor(context.supabase, context.userId, data.orgId);
    const prev = await loadInterview(context.supabase, data.orgId, data.id);
    if (!["requested", "scheduling"].includes(prev.status)) {
        throw new Error(`invalid_transition:${prev.status}->scheduling`);
    }
    // Same rules as the form: two or three future slots, none inside 24 hours,
    // no duplicates, every attendee reachable by email.
    const times = assertProposedSlots(data.proposedTimes);
    if (data.timezone && !isValidTimezone(data.timezone))
        throw new Error("invalid_timezone");
    for (const p of data.participants ?? []) {
        if (p.email && !isEmail(p.email))
            throw new Error("invalid_attendee_email");
    }
    const { error } = await context.supabase
        .from("interviews")
        .update({
        status: "scheduling",
        proposed_times: times,
        ...(data.interviewType ? { interview_type: data.interviewType } : {}),
        ...(data.timezone ? { timezone: data.timezone } : {}),
        ...(data.durationMinutes ? { duration_minutes: data.durationMinutes } : {}),
        ...(data.participants ? { participants: data.participants } : {}),
        ...(data.notes ? { notes: data.notes } : {}),
        availability_expires_at: times[times.length - 1],
        updated_by: context.userId,
    })
        .eq("id", data.id)
        .eq("organization_id", data.orgId);
    if (error)
        throw new Error(error.message);
    await writeAudit(context.supabase, {
        actor: context.userId,
        action: "interview.proposed",
        entity_id: data.id,
        organization_id: data.orgId,
        before: { status: prev.status },
        after: { status: "scheduling", proposed_times: times },
        trace_id: trace,
    });
    // The recruiting team confirms with the candidate — nothing is sent from
    // the client account.
    try {
        const { emitInterviewEvent } = await import("./interview-events.server");
        await emitInterviewEvent({
            interviewId: data.id,
            event: "interview_requested",
            actorUserId: context.userId,
            scopeSuffix: times.join(","),
        });
    }
    catch (e) {
        console.error("[proposeInterviewTimes] emit failed", trace, e);
    }
    return { ok: true, trace_id: trace, proposed_times: times };
});
export const confirmInterviewTime = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input) => z
    .object({
    orgId: z.string().uuid(),
    id: z.string().uuid(),
    scheduledAt: z.string().datetime(),
    timezone: z.string().min(1).max(80),
    durationMinutes: z.number().int().min(15).max(480),
    meetingUrl: z.string().url().max(500).optional(),
    location: z.string().max(500).optional(),
})
    .parse(input))
    .handler(async ({ context, data }) => {
    const trace = traceId();
    await assertEditor(context.supabase, context.userId, data.orgId);
    const prev = await loadInterview(context.supabase, data.orgId, data.id);
    if (!["requested", "scheduling", "scheduled"].includes(prev.status)) {
        throw new Error(`invalid_transition:${prev.status}->scheduled`);
    }
    if (!isValidTimezone(data.timezone))
        throw new Error("invalid_timezone");
    const scheduledAt = new Date(data.scheduledAt);
    if (scheduledAt.getTime() < Date.now() - 60 * 1000) {
        throw new Error("scheduled_in_past");
    }
    const isReschedule = prev.status === "scheduled";
    // Confirming the identical time again is a no-op, not a new event.
    if (isReschedule && prev.scheduled_at === scheduledAt.toISOString()) {
        return { ok: true, trace_id: trace, unchanged: true };
    }
    const expiry = prev.availability_expires_at;
    if (!isReschedule && expiry && new Date(expiry).getTime() < Date.now()) {
        throw new Error("availability_expired");
    }
    // Guard against two live meetings for the same candidate.
    const { data: clash } = await context.supabase
        .from("interviews")
        .select("id")
        .eq("candidate_match_id", prev.candidate_match_id)
        .eq("status", "scheduled")
        .neq("id", data.id)
        .maybeSingle();
    if (clash)
        throw new Error("duplicate_scheduled_interview");
    const { error } = await context.supabase
        .from("interviews")
        .update({
        status: "scheduled",
        scheduled_at: scheduledAt.toISOString(),
        previous_scheduled_at: isReschedule ? prev.scheduled_at : null,
        reschedule_count: isReschedule
            ? Number(prev.reschedule_count ?? 0) + 1
            : Number(prev.reschedule_count ?? 0),
        timezone: data.timezone,
        duration_minutes: data.durationMinutes,
        meeting_url: data.meetingUrl ?? null,
        location: data.location ?? null,
        updated_by: context.userId,
    })
        .eq("id", data.id)
        .eq("organization_id", data.orgId);
    if (error)
        throw new Error(error.message);
    await writeAudit(context.supabase, {
        actor: context.userId,
        action: isReschedule ? "interview.rescheduled" : "interview.scheduled",
        entity_id: data.id,
        organization_id: data.orgId,
        before: { status: prev.status, scheduled_at: prev.scheduled_at },
        after: { status: "scheduled", scheduled_at: scheduledAt.toISOString() },
        trace_id: trace,
    });
    try {
        const { emitInterviewEvent } = await import("./interview-events.server");
        await emitInterviewEvent({
            interviewId: data.id,
            event: "interview_scheduled",
            actorUserId: context.userId,
            scopeSuffix: scheduledAt.toISOString(),
        });
    }
    catch (e) {
        console.error("[confirmInterviewTime] emit failed", trace, e);
    }
    try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await resolveNotificationsForUser(supabaseAdmin, context.userId);
    }
    catch (e) {
        console.error("[confirmInterviewTime] resolver failed", trace, e);
    }
    return { ok: true, trace_id: trace, rescheduled: isReschedule };
});
export const cancelInterview = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input) => z
    .object({
    orgId: z.string().uuid(),
    id: z.string().uuid(),
    reason: z.string().max(1000).optional(),
})
    .parse(input))
    .handler(async ({ context, data }) => {
    const trace = traceId();
    await assertEditor(context.supabase, context.userId, data.orgId);
    const prev = await loadInterview(context.supabase, data.orgId, data.id);
    if (prev.status === "cancelled" || prev.status === "completed") {
        throw new Error(`invalid_transition:${prev.status}->cancelled`);
    }
    const { error } = await context.supabase
        .from("interviews")
        .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: data.reason ?? null,
        updated_by: context.userId,
    })
        .eq("id", data.id)
        .eq("organization_id", data.orgId);
    if (error)
        throw new Error(error.message);
    await writeAudit(context.supabase, {
        actor: context.userId,
        action: "interview.cancelled",
        entity_id: data.id,
        organization_id: data.orgId,
        before: { status: prev.status },
        after: { status: "cancelled", reason: data.reason ?? null },
        trace_id: trace,
    });
    try {
        const { emitInterviewEvent } = await import("./interview-events.server");
        await emitInterviewEvent({
            interviewId: data.id,
            event: "interview_cancelled",
            actorUserId: context.userId,
            scopeSuffix: prev.scheduled_at ?? prev.status,
        });
    }
    catch (e) {
        console.error("[cancelInterview] emit failed", trace, e);
    }
    try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await resolveNotificationsForUser(supabaseAdmin, context.userId);
    }
    catch (e) {
        console.error("[cancelInterview] resolver failed", trace, e);
    }
    return { ok: true, trace_id: trace };
});
export const markInterviewCompleted = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input) => z
    .object({
    orgId: z.string().uuid(),
    id: z.string().uuid(),
    feedback: z.string().max(4000).optional(),
})
    .parse(input))
    .handler(async ({ context, data }) => {
    const trace = traceId();
    await assertEditor(context.supabase, context.userId, data.orgId);
    const prev = await loadInterview(context.supabase, data.orgId, data.id);
    if (prev.status !== "scheduled") {
        throw new Error(`invalid_transition:${prev.status}->completed`);
    }
    // A meeting that has not started cannot be completed. Without this guard a
    // future interview could be stamped completed and then read as "already
    // happened" everywhere downstream.
    if (!prev.scheduled_at || new Date(prev.scheduled_at).getTime() > Date.now()) {
        throw new Error("interview_not_started");
    }
    const { error } = await context.supabase
        .from("interviews")
        .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        feedback: data.feedback ?? prev.feedback ?? null,
        updated_by: context.userId,
    })
        .eq("id", data.id)
        .eq("organization_id", data.orgId);
    if (error)
        throw new Error(error.message);
    await writeAudit(context.supabase, {
        actor: context.userId,
        action: "interview.completed",
        entity_id: data.id,
        organization_id: data.orgId,
        before: { status: "scheduled" },
        after: { status: "completed" },
        trace_id: trace,
    });
    try {
        const { emitInterviewEvent } = await import("./interview-events.server");
        await emitInterviewEvent({
            interviewId: data.id,
            event: "interview_completed",
            actorUserId: context.userId,
        });
    }
    catch (e) {
        console.error("[markInterviewCompleted] emit failed", trace, e);
    }
    try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await resolveNotificationsForUser(supabaseAdmin, context.userId);
    }
    catch (e) {
        console.error("[markInterviewCompleted] resolver failed", trace, e);
    }
    return { ok: true, trace_id: trace };
});
export const listSchedulableCandidates = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input) => z.object({ orgId: z.string().uuid() }).parse(input))
    .handler(async ({ context, data }) => {
    await assertWorkspaceAccess(context.supabase, context.userId, data.orgId);
    const { data: rows, error } = await context.supabase
        .from("candidate_matches")
        .select("id, position_id, stage, client_visibility, candidate_profile_id, candidate_profiles:candidate_profile_id(id, full_name, email), positions:position_id(id, title)")
        .eq("organization_id", data.orgId)
        .eq("client_visibility", "visible")
        .in("stage", ["delivered", "shortlisted", "interview_process", "offer", "hired"]);
    if (error)
        throw new Error(error.message);
    const { hydrateClientCandidateProfiles: hydrateSchedulable } = await import("@/lib/client-candidate-hydrate.server");
    const list = await hydrateSchedulable(rows ?? []);
    const { data: active } = await context.supabase
        .from("interviews")
        .select("candidate_match_id")
        .eq("organization_id", data.orgId)
        .in("status", ["requested", "scheduling", "scheduled"]);
    const activeSet = new Set(active?.map((r) => r.candidate_match_id) ?? []);
    const candidates = list.map((r) => ({
        match_id: r.id,
        candidate_id: r.candidate_profiles?.id ?? r.candidate_profile_id,
        candidate_name: r.candidate_profiles?.full_name ?? "Candidate",
        candidate_email: r.candidate_profiles?.email ?? null,
        position_id: r.positions?.id ?? r.position_id,
        position_title: r.positions?.title ?? "Position",
        stage: r.stage,
        has_active_interview: activeSet.has(r.id),
        availability_preference: parseStoredPreference(r.candidate_profiles?.availability),
    }));
    return { candidates };
});

// Candidate self-service service layer (Phase 9).
// All reads/writes use the authenticated Supabase client (RLS applies as caller).
// The candidate NEVER sees scores, rankings, admin_status, or processing errors.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { computePendingAction } from "@/lib/candidate/pending-action";
import { buildCandidateTimeline } from "@/lib/candidate/timeline";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

// PostgREST returns embedded relations as an object (not array) when the
// foreign key is UNIQUE. candidate_matches.application_id is UNIQUE, so
// `applications → candidate_matches` comes back as an object or null.
// Normalize to an array so downstream code can use array methods.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asArray<T = any>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

const traceId = () =>
  `cd_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
import {
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_COPY,
  canWithdrawFrom,
  toCandidateStatus,
  type CandidateStatus,
} from "@/lib/candidate/status-vocabulary";

// ─── Candidate-safe status vocabulary ───────────────────────────────────────
// One vocabulary, defined in @/lib/candidate/status-vocabulary and shared with
// the list, detail, public lookup and email surfaces. Nothing internal leaks.
export type CandidateSafeStatus = CandidateStatus;

export const CANDIDATE_SAFE_STATUSES: CandidateSafeStatus[] = [...CANDIDATE_STATUSES];

export const TERMINAL_STATUSES: CandidateSafeStatus[] = ["Closed"];

// ─── Context: link auth user to candidate profile (auto-claim by email) ─────

export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as AnyRow;
    const userId = context.userId;
    const email = (context.claims?.email as string | undefined)?.toLowerCase();

    const PROFILE_COLS =
      "id,user_id,full_name,email,phone,location,headline,summary,years_experience,timezone,linkedin_url,portfolio_url,certifications,experience,skills,education,languages,work_authorization,availability,compensation_preferences,current_cv_file_id,consent,created_at,updated_at";

    let { data: cp } = await supabase
      .from("candidate_profiles")
      .select(PROFILE_COLS)
      .eq("user_id", userId)
      .maybeSingle();

    // Auto-claim: unclaimed profile matching this email.
    if (!cp && email) {
      const { data: claimable } = await supabase
        .from("candidate_profiles")
        .select("id,user_id")
        .ilike("email", email)
        .is("user_id", null)
        .maybeSingle();
      if (claimable) {
        const { data: claimed } = await supabase
          .from("candidate_profiles")
          .update({ user_id: userId })
          .eq("id", claimable.id)
          .is("user_id", null)
          .select(PROFILE_COLS)
          .maybeSingle();
        cp = claimed ?? cp;
      }
    }


    return {
      user_id: userId,
      email: email ?? null,
      profile: cp ?? null,
    };
  });

// ─── Applications list + detail ─────────────────────────────────────────────

type InterviewState = "none" | "requested" | "scheduled";

function interviewStateOf(rows: AnyRow[]): InterviewState {
  const live = rows.filter(
    (i) => i.status !== "cancelled" && i.status !== "declined",
  );
  if (live.some((i) => i.scheduled_at)) return "scheduled";
  if (live.length > 0) return "requested";
  return "none";
}

function canWithdraw(status: CandidateSafeStatus): boolean {
  return canWithdrawFrom(status);
}

async function myProfileId(supabase: AnyRow, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("candidate_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

export const listMyApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as AnyRow;
    const cpId = await myProfileId(supabase, context.userId);
    if (!cpId) return { applications: [] as AnyRow[] };

    const { data: apps, error } = await supabase
      .from("applications")
      .select(
        `id, position_id, status, applied_at, updated_at, withdrawn_at, cv_file_id,
         positions:position_id ( id, title, status, organization_id, employment_type, work_model, location, organizations:organization_id ( id, name ) ),
         candidate_matches ( id, stage, client_visibility, updated_at,
           interviews ( id, status, scheduled_at, interview_type, timezone ) )`,
      )
      .eq("candidate_profile_id", cpId)
      .order("applied_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Open information requests are the canonical source for that status.
    const { data: openReqs } = await supabase
      .from("candidate_info_requests")
      .select("id, application_id")
      .eq("candidate_profile_id", cpId)
      .eq("status", "open");
    const openByApp = new Set((openReqs ?? []).map((r: AnyRow) => r.application_id));

    const shaped = (apps ?? []).map((a: AnyRow) => {
      const pos = a.positions ?? {};
      const org = pos.organizations ?? {};
      const matches = asArray(a.candidate_matches);
      const visibleMatch = matches.find((m: AnyRow) => m.client_visibility === "visible");
      const interviews = matches.flatMap((m: AnyRow) => asArray(m.interviews));
      const interviewState = interviewStateOf(interviews);
      const infoRequested = openByApp.has(a.id);
      const status = toCandidateStatus({
        applicationStatus: a.status,
        positionStatus: pos.status ?? "active",
        matchStage: visibleMatch?.stage ?? null,
        matchVisible: Boolean(visibleMatch),
        interviewState,
        withdrawnAt: a.withdrawn_at ?? null,
      });
      const nextInterview = interviews
        .filter((i: AnyRow) => i.scheduled_at && i.status !== "cancelled")
        .sort((x: AnyRow, y: AnyRow) => String(x.scheduled_at).localeCompare(String(y.scheduled_at)))[0];
      return {
        id: a.id,
        position_id: pos.id,
        role_title: pos.title ?? "Role",
        company: org.name ?? null,
        employment_type: pos.employment_type ?? null,
        work_model: pos.work_model ?? null,
        location: pos.location ?? null,
        applied_at: a.applied_at,
        last_update: visibleMatch?.updated_at ?? a.updated_at ?? a.applied_at,
        status,
        role_closed: (pos.status ?? "active") === "closed" || (pos.status ?? "") === "filled",
        info_requested: infoRequested,
        next_interview_at: nextInterview?.scheduled_at ?? null,
        has_document: !!a.cv_file_id,
        can_withdraw: canWithdraw(status),
        next_step: nextStepHint(status),
      };
    });
    return { applications: shaped };
  });

function nextStepHint(status: CandidateSafeStatus): string {
  return CANDIDATE_STATUS_COPY[status].nextStep;
}

export const getMyApplication = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const supabase = context.supabase as AnyRow;
    const cpId = await myProfileId(supabase, context.userId);
    if (!cpId) throw new Error("No candidate profile");

    const { data: a, error } = await supabase
      .from("applications")
      .select(
        `id, position_id, status, applied_at, updated_at, withdrawn_at, candidate_profile_id,
         cover_letter, portfolio_url, cv_file_id,
         positions:position_id ( id, title, description, status, organization_id, employment_type, work_model, location, organizations:organization_id ( id, name ) ),
         candidate_matches ( id, stage, client_visibility, updated_at,
           interviews ( id, status, scheduled_at, duration_minutes, interview_type, location, meeting_url, timezone, requested_at, cancelled_at ) )`,
      )
      .eq("id", data.id)
      .eq("candidate_profile_id", cpId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!a) throw new Error("Not found");

    const [{ data: reqs }, { data: cvFile }] = await Promise.all([
      supabase
        .from("candidate_info_requests")
        .select("id, prompt, status, response, responded_at, due_at, created_at")
        .eq("application_id", a.id)
        .order("created_at", { ascending: false }),
      a.cv_file_id
        ? supabase
            .from("files")
            .select("id, filename, size, created_at, parse_state")
            .eq("id", a.cv_file_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const pos = a.positions ?? {};
    const org = pos.organizations ?? {};
    const matches = asArray(a.candidate_matches);
    const visibleMatch = matches.find((m: AnyRow) => m.client_visibility === "visible");
    const interviews = matches
      .flatMap((m: AnyRow) => asArray(m.interviews))
      .map((i: AnyRow) => ({
        id: i.id,
        status: i.status as string,
        scheduled_at: i.scheduled_at as string | null,
        duration_minutes: i.duration_minutes as number | null,
        interview_type: i.interview_type as string | null,
        location: i.location as string | null,
        meeting_url: i.meeting_url as string | null,
        timezone: i.timezone as string | null,
        requested_at: i.requested_at as string,
        cancelled_at: i.cancelled_at as string | null,
      }));
    const infoRequests = (reqs ?? []) as Array<{
      id: string;
      prompt: string;
      status: string;
      response: string | null;
      responded_at: string | null;
      due_at: string | null;
      created_at: string;
    }>;
    const infoRequested = infoRequests.some((r) => r.status === "open");

    const status = toCandidateStatus({
      applicationStatus: a.status,
      positionStatus: pos.status ?? "active",
      matchStage: visibleMatch?.stage ?? null,
      matchVisible: Boolean(visibleMatch),
      interviewState: interviewStateOf(interviews),
      withdrawnAt: a.withdrawn_at ?? null,
    });

    // Recorded stage history only. Candidates cannot read this table under RLS,
    // so it is loaded privileged *after* the application was proven to be
    // theirs above, and mapped to the eight candidate-safe labels. Actor,
    // reason and internal stages are never returned.
    const matchIds = matches.map((m: AnyRow) => m.id as string);
    let stageHistory: Array<{ to_stage: string; created_at: string }> = [];
    if (matchIds.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: hist } = await (supabaseAdmin as AnyRow)
        .from("candidate_stage_history")
        .select("to_stage, created_at")
        .in("candidate_match_id", matchIds)
        .order("created_at", { ascending: true });
      stageHistory = (hist ?? []) as Array<{ to_stage: string; created_at: string }>;
    }

    const events = buildCandidateTimeline({
      appliedAt: a.applied_at,
      cv: cvFile
        ? {
            uploaded_at: cvFile.created_at as string,
            received: cvFile.parse_state !== "failed",
          }
        : null,
      stageHistory,
      interviews,
      withdrawnAt: (a.withdrawn_at as string | null) ?? null,
    });

    return {
      id: a.id,
      role_title: pos.title ?? "Role",
      role_description: pos.description ?? "",
      company: org.name ?? null,
      employment_type: pos.employment_type ?? null,
      work_model: pos.work_model ?? null,
      location: pos.location ?? null,
      role_closed: (pos.status ?? "active") === "closed" || (pos.status ?? "") === "filled",
      applied_at: a.applied_at,
      cover_letter: (a.cover_letter as string | null) ?? null,
      portfolio_url: (a.portfolio_url as string | null) ?? null,
      document: cvFile
        ? {
            id: cvFile.id as string,
            filename: cvFile.filename as string,
            size: (cvFile.size as number | null) ?? null,
            uploaded_at: cvFile.created_at as string,
            received: cvFile.parse_state !== "failed",
          }
        : null,
      status,
      next_step: nextStepHint(status),
      // Derived from real pending rows only — never from the stage.
      pending_action: computePendingAction({
        infoRequests: infoRequests,
        interviews,
        document: cvFile ? { received: cvFile.parse_state !== "failed" } : null,
        closed: status === "Closed",
      }),
      can_withdraw: canWithdraw(status),
      info_requests: infoRequests,
      interviews,
      events,
    };
  });

// ─── Information requests ───────────────────────────────────────────────────

export const listMyInfoRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as AnyRow;
    const cpId = await myProfileId(supabase, context.userId);
    if (!cpId) return { requests: [] as AnyRow[] };
    const { data, error } = await supabase
      .from("candidate_info_requests")
      .select(
        "id, application_id, prompt, status, response, responded_at, due_at, created_at, applications:application_id ( id, positions:position_id ( title ) )",
      )
      .eq("candidate_profile_id", cpId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const requests = (data ?? []).map((r: AnyRow) => ({
      id: r.id as string,
      application_id: r.application_id as string,
      role_title: r.applications?.positions?.title ?? "Role",
      prompt: r.prompt as string,
      status: r.status as string,
      response: (r.response as string | null) ?? null,
      responded_at: (r.responded_at as string | null) ?? null,
      due_at: (r.due_at as string | null) ?? null,
      created_at: r.created_at as string,
      expired:
        r.status === "open" && !!r.due_at && new Date(r.due_at).getTime() < Date.now(),
    }));
    return { requests };
  });

export const respondToInfoRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; response: string }) =>
    z
      .object({
        id: z.string().uuid(),
        response: z.string().trim().min(1, "Please write a reply").max(4000),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const trace = traceId();
    const supabase = context.supabase as AnyRow;
    const cpId = await myProfileId(supabase, context.userId);
    if (!cpId) return { ok: false as const, trace_id: trace, message: "No profile" };

    const { data: req } = await supabase
      .from("candidate_info_requests")
      .select("id, status, due_at, application_id")
      .eq("id", data.id)
      .eq("candidate_profile_id", cpId)
      .maybeSingle();
    if (!req) return { ok: false as const, trace_id: trace, message: "Request not found" };
    if (req.status !== "open") {
      return {
        ok: false as const,
        trace_id: trace,
        message: "This request is already closed.",
      };
    }
    if (req.due_at && new Date(req.due_at).getTime() < Date.now()) {
      return {
        ok: false as const,
        trace_id: trace,
        message: "This request has expired. Send a message instead and we'll pick it up.",
      };
    }

    const { error } = await supabase
      .from("candidate_info_requests")
      .update({
        response: data.response,
        status: "answered",
        responded_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "open");
    if (error) return { ok: false as const, trace_id: trace, message: error.message };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_events").insert({
      actor_user_id: context.userId,
      entity_type: "candidate_info_requests",
      entity_id: data.id,
      action: "candidate_info_response",
      trace_id: trace,
    });
    return { ok: true as const, trace_id: trace };
  });

// ─── Dashboard summary ──────────────────────────────────────────────────────

export const getMyDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as AnyRow;
    const cpId = await myProfileId(supabase, context.userId);
    if (!cpId) {
      return {
        open_requests: 0,
        upcoming_interviews: [] as AnyRow[],
        unread_messages: 0,
        document: null as AnyRow | null,
      };
    }

    const [{ count: openCount }, { data: profile }, { count: unread }] = await Promise.all([
      supabase
        .from("candidate_info_requests")
        .select("id", { count: "exact", head: true })
        .eq("candidate_profile_id", cpId)
        .eq("status", "open"),
      supabase
        .from("candidate_profiles")
        .select("current_cv_file_id")
        .eq("id", cpId)
        .maybeSingle(),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_context->>candidate_user_id", context.userId)
        .is("read_at", null),
    ]);

    const { data: matches } = await supabase
      .from("candidate_matches")
      .select(
        "id, application_id, positions:position_id ( title ), interviews ( id, status, scheduled_at, duration_minutes, interview_type, location, meeting_url, timezone )",
      )
      .eq("candidate_profile_id", cpId);

    const now = Date.now();
    const upcoming = (matches ?? [])
      .flatMap((m: AnyRow) =>
        asArray(m.interviews).map((i: AnyRow) => ({
          ...i,
          application_id: m.application_id as string,
          role_title: m.positions?.title ?? "Role",
        })),
      )
      .filter(
        (i: AnyRow) =>
          i.scheduled_at &&
          i.status !== "cancelled" &&
          new Date(i.scheduled_at).getTime() > now,
      )
      .sort((a: AnyRow, b: AnyRow) =>
        String(a.scheduled_at).localeCompare(String(b.scheduled_at)),
      )
      .slice(0, 3);

    let document: AnyRow | null = null;
    if (profile?.current_cv_file_id) {
      const { data: f } = await supabase
        .from("files")
        .select("id, filename, size, created_at, parse_state")
        .eq("id", profile.current_cv_file_id)
        .maybeSingle();
      if (f) {
        document = {
          id: f.id,
          filename: f.filename,
          size: f.size,
          uploaded_at: f.created_at,
          received: f.parse_state !== "failed",
        };
      }
    }

    return {
      open_requests: openCount ?? 0,
      upcoming_interviews: upcoming,
      unread_messages: unread ?? 0,
      document,
    };
  });



// ─── Withdraw application ───────────────────────────────────────────────────

export const withdrawApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const trace = traceId();
    const supabase = context.supabase as AnyRow;
    const { data: cp } = await supabase
      .from("candidate_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!cp) return { ok: false, trace_id: trace, message: "No profile" };

    // Verify ownership (RLS allows read; we also want to write via admin).
    const { data: a } = await supabase
      .from("applications")
      .select("id,status,candidate_profile_id")
      .eq("id", data.id)
      .eq("candidate_profile_id", cp.id)
      .maybeSingle();
    if (!a) return { ok: false, trace_id: trace, message: "Not found" };
    if (a.status === "withdrawn" || a.status === "rejected" || a.status === "archived") {
      return { ok: false, trace_id: trace, message: "Cannot withdraw" };
    }

    // Applications RLS only allows insert by candidate; updates require staff.
    // Use admin client for the audited state change.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("applications")
      .update({ status: "withdrawn", withdrawn_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) return { ok: false, trace_id: trace, message: error.message };

    // Hide any related visible matches from the client too.
    await supabaseAdmin
      .from("candidate_matches")
      .update({ client_visibility: "hidden" })
      .eq("application_id", data.id);

    await supabaseAdmin.from("audit_events").insert({
      actor_user_id: context.userId,
      entity_type: "applications",
      entity_id: data.id,
      action: "candidate_withdraw",
      trace_id: trace,
    });
    return { ok: true, trace_id: trace };
  });

// ─── Profile update ─────────────────────────────────────────────────────────

const profileSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(50).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  headline: z.string().trim().max(300).optional().nullable(),
  summary: z.string().trim().max(4000).optional().nullable(),
  years_experience: z.coerce.number().int().min(0).max(80).optional().nullable(),
  timezone: z.string().trim().max(80).optional().nullable(),
  linkedin_url: z.string().trim().max(300).optional().nullable(),
  portfolio_url: z.string().trim().max(300).optional().nullable(),
  certifications: z.array(z.any()).max(50).default([]),
  experience: z.array(z.any()).max(50).default([]),
  skills: z.array(z.string().trim().min(1).max(60)).max(100).default([]),
  education: z.array(z.any()).max(30).default([]),
  languages: z.array(z.any()).max(30).default([]),
  work_authorization: z.any().optional().nullable(),
  availability: z.any().optional().nullable(),
  compensation_preferences: z.any().optional().nullable(),
});


export type ProfilePatch = z.infer<typeof profileSchema>;

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileSchema.parse(input))
  .handler(async ({ context, data }) => {
    const trace = traceId();
    const supabase = context.supabase as AnyRow;
    const { data: cp } = await supabase
      .from("candidate_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!cp) return { ok: false, trace_id: trace, message: "No profile" };

    const { error } = await supabase
      .from("candidate_profiles")
      .update({
        full_name: data.full_name,
        phone: data.phone || null,
        location: data.location || null,
        headline: data.headline || null,
        summary: data.summary || null,
        years_experience: data.years_experience ?? null,
        timezone: data.timezone || null,
        linkedin_url: data.linkedin_url || null,
        portfolio_url: data.portfolio_url || null,
        certifications: data.certifications,
        experience: data.experience,
        skills: data.skills,
        education: data.education,
        languages: data.languages,
        work_authorization: data.work_authorization ?? null,
        availability: data.availability ?? null,
        compensation_preferences: data.compensation_preferences ?? null,
      })
      .eq("id", cp.id);

    if (error) return { ok: false, trace_id: trace, message: error.message };

    // Mark active matches for staff review (candidate never sees this state).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("candidate_matches")
      .update({ processing_state: "ready_to_score" })
      .eq("candidate_profile_id", cp.id)
      .in("processing_state", ["scored", "manual_review_required"]);

    return { ok: true, trace_id: trace };
  });

// ─── CV replacement ─────────────────────────────────────────────────────────

const cvSchema = z.object({
  filename: z.string().min(1).max(200),
  mime: z.string().min(1).max(100),
  base64: z.string().min(1),
});

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",", 2)[1] : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "cv";
}

export const replaceMyCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cvSchema.parse(input))
  .handler(async ({ context, data }) => {
    const trace = traceId();
    const bytes = b64ToBytes(data.base64);
    const { validateCv } = await import("./cv-validation");
    const v = await validateCv(bytes, data.filename, data.mime);
    if (!v.ok) {
      return { ok: false, trace_id: trace, message: v.message ?? "Invalid CV" };
    }

    const supabase = context.supabase as AnyRow;
    const { data: cp } = await supabase
      .from("candidate_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!cp) return { ok: false, trace_id: trace, message: "No profile" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const storagePath = `candidate/${cp.id}/${Date.now()}-${safeName(data.filename)}`;
    const upload = await supabaseAdmin.storage
      .from("cvs")
      .upload(storagePath, bytes, {
        contentType: v.detected_mime ?? data.mime,
        upsert: false,
      });
    if (upload.error) return { ok: false, trace_id: trace, message: upload.error.message };

    const { data: fileRow, error: fileErr } = await supabaseAdmin
      .from("files")
      .insert({
        owner_user_id: context.userId,
        candidate_profile_id: cp.id,
        storage_bucket: "cvs",
        storage_path: storagePath,
        filename: data.filename,
        mime_type: v.detected_mime ?? data.mime,
        size: bytes.length,
        checksum: v.sha256 ?? null,
        file_status: "ready",
      })
      .select("id")
      .single();
    if (fileErr) return { ok: false, trace_id: trace, message: fileErr.message };

    await supabase
      .from("candidate_profiles")
      .update({ current_cv_file_id: fileRow.id })
      .eq("id", cp.id);

    // Mark matches for re-processing (silent to candidate).
    await supabaseAdmin
      .from("candidate_matches")
      .update({ processing_state: "queued" })
      .eq("candidate_profile_id", cp.id)
      .in("processing_state", ["scored", "manual_review_required", "failed"]);

    await supabaseAdmin.from("audit_events").insert({
      actor_user_id: context.userId,
      entity_type: "candidate_profiles",
      entity_id: cp.id,
      action: "cv_replaced",
      trace_id: trace,
    });

    return { ok: true, trace_id: trace, file_id: fileRow.id };
  });

// ─── Messages ───────────────────────────────────────────────────────────────

export const listMyMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as AnyRow;
    const { data, error } = await supabase
      .from("messages")
      .select("id,thread_id,sender_user_id,body,created_at,read_at,recipient_context")
      .or(
        `sender_user_id.eq.${context.userId},recipient_context->>candidate_user_id.eq.${context.userId}`,
      )
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { messages: (data ?? []) as AnyRow[] };
  });

export const sendMyMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { body: string }) =>
    z.object({ body: z.string().trim().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase as AnyRow;
    const { error } = await supabase.from("messages").insert({
      sender_user_id: context.userId,
      body: data.body,
      recipient_context: { audience: "taasflow_ops", from: "candidate" },
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  });

// ─── Privacy / consent ──────────────────────────────────────────────────────

const consentSchema = z.object({
  network_opt_in: z.boolean().optional(),
  marketing_opt_in: z.boolean().optional(),
  notifications_email: z.boolean().optional(),
  notifications_sms: z.boolean().optional(),
});

export const updateMyConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => consentSchema.parse(input))
  .handler(async ({ context, data }) => {
    const trace = traceId();
    const supabase = context.supabase as AnyRow;
    const { data: cp } = await supabase
      .from("candidate_profiles")
      .select("id, consent")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!cp) return { ok: false, trace_id: trace, message: "No profile" };
    const prev = (cp.consent ?? {}) as Record<string, unknown>;
    const next = {
      ...prev,
      ...data,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("candidate_profiles")
      .update({ consent: next })
      .eq("id", cp.id);
    if (error) return { ok: false, trace_id: trace, message: error.message };
    return { ok: true, trace_id: trace, consent: next };
  });

export const requestAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reason?: string }) =>
    z.object({ reason: z.string().max(2000).optional() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const trace = traceId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_events").insert({
      actor_user_id: context.userId,
      entity_type: "candidate_profiles",
      entity_id: null,
      action: "deletion_requested",
      trace_id: trace,
      after_state: { reason: data.reason ?? null },
    });
    return { ok: true, trace_id: trace };
  });

export const requestCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { note: string }) =>
    z.object({ note: z.string().trim().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase as AnyRow;
    const { error } = await supabase.from("messages").insert({
      sender_user_id: context.userId,
      body: `[Data correction request]\n${data.note}`,
      recipient_context: { audience: "taasflow_ops", from: "candidate", kind: "correction_request" },
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  });

// ─── CV versions / download ─────────────────────────────────────────────────

export const listMyCvVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as AnyRow;
    const { data: cp } = await supabase
      .from("candidate_profiles")
      .select("id,current_cv_file_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!cp) return { current_id: null, versions: [] as AnyRow[] };
    const { data, error } = await supabase
      .from("files")
      .select("id,filename,mime_type,size,checksum,created_at")
      .eq("candidate_profile_id", cp.id)
      .eq("storage_bucket", "cvs")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { current_id: cp.current_cv_file_id ?? null, versions: (data ?? []) as AnyRow[] };
  });

export const getMyCvDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { file_id: string }) =>
    z.object({ file_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase as AnyRow;
    const { data: cp } = await supabase
      .from("candidate_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!cp) return { ok: false as const, message: "No profile" };
    const { data: f } = await supabase
      .from("files")
      .select("id,storage_bucket,storage_path,filename")
      .eq("id", data.file_id)
      .eq("candidate_profile_id", cp.id)
      .maybeSingle();
    if (!f) return { ok: false as const, message: "Not found" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(f.storage_bucket)
      .createSignedUrl(f.storage_path, 60);
    if (error || !signed) return { ok: false as const, message: error?.message ?? "Sign failed" };
    return { ok: true as const, url: signed.signedUrl, filename: f.filename };
  });

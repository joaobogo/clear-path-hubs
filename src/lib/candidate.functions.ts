// Candidate self-service service layer (Phase 9).
// All reads/writes use the authenticated Supabase client (RLS applies as caller).
// The candidate NEVER sees scores, rankings, admin_status, or processing errors.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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

// ─── Candidate-safe status vocabulary ───────────────────────────────────────
// Canonical, candidate-facing only. Never exposes scores, rankings, client
// identity decisions, admin notes, or internal processing states.
export type CandidateSafeStatus =
  | "Submitted"
  | "Under review"
  | "Additional information requested"
  | "Progressing"
  | "Interview requested"
  | "Interview scheduled"
  | "Closed"
  | "Withdrawn";

export const CANDIDATE_SAFE_STATUSES: CandidateSafeStatus[] = [
  "Submitted",
  "Under review",
  "Additional information requested",
  "Progressing",
  "Interview requested",
  "Interview scheduled",
  "Closed",
  "Withdrawn",
];

export const TERMINAL_STATUSES: CandidateSafeStatus[] = ["Closed", "Withdrawn"];

// Map internal workflow state → single candidate-safe label.
function mapStatus(input: {
  applicationStatus: string;
  positionStatus: string;
  visibleStage: string | null;
  infoRequested: boolean;
  interviewState: "none" | "requested" | "scheduled";
}): CandidateSafeStatus {
  if (input.applicationStatus === "withdrawn" || input.applicationStatus === "archived") {
    return "Withdrawn";
  }
  if (input.applicationStatus === "rejected") return "Closed";
  if (input.positionStatus === "closed" || input.positionStatus === "filled") return "Closed";
  if (input.infoRequested) return "Additional information requested";
  if (input.interviewState === "scheduled") return "Interview scheduled";
  if (input.interviewState === "requested") return "Interview requested";
  if (input.visibleStage) {
    switch (input.visibleStage) {
      case "not_moving_forward":
        return "Closed";
      case "interview_process":
        return "Interview requested";
      case "hired":
      case "offer":
      case "shortlisted":
        return "Progressing";
      default:
        return "Under review";
    }
  }
  if (input.applicationStatus === "ready_for_review") return "Under review";
  if (input.applicationStatus === "processing") return "Under review";
  return "Submitted";
}



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

export const listMyApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as AnyRow;
    // Get candidate profile id first (RLS on applications requires ownership).
    const { data: cp } = await supabase
      .from("candidate_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!cp) return { applications: [] as AnyRow[] };

    const { data: apps, error } = await supabase
      .from("applications")
      .select(
        `id, position_id, status, applied_at, updated_at, withdrawn_at,
         positions:position_id ( id, title, status, organization_id, employment_type, work_model, location, organizations:organization_id ( id, name ) ),
         candidate_matches ( id, stage, client_visibility, updated_at,
           client_decisions ( decision, created_at ) )`,
      )
      .eq("candidate_profile_id", cp.id)
      .order("applied_at", { ascending: false });
    if (error) throw new Error(error.message);

    const shaped = (apps ?? []).map((a: AnyRow) => {
      const pos = a.positions ?? {};
      const org = pos.organizations ?? {};
      const visibleMatch = (asArray(a.candidate_matches)).find(
        (m: AnyRow) => m.client_visibility === "visible",
      );
      const infoRequested = (asArray(a.candidate_matches)).some((m: AnyRow) =>
        (asArray(m.client_decisions)).some(
          (d: AnyRow) => d.decision === "request_information",
        ),
      );
      const status = mapStatus({
        applicationStatus: a.status,
        positionStatus: pos.status ?? "active",
        visibleStage: visibleMatch?.stage ?? null,
        infoRequested,
      });
      const lastUpdate =
        visibleMatch?.updated_at ?? a.updated_at ?? a.applied_at;
      return {
        id: a.id,
        position_id: pos.id,
        role_title: pos.title ?? "Role",
        company: org.name ?? null,
        employment_type: pos.employment_type ?? null,
        work_model: pos.work_model ?? null,
        location: pos.location ?? null,
        applied_at: a.applied_at,
        last_update: lastUpdate,
        status,
        can_withdraw:
          status !== "Withdrawn" &&
          status !== "Not selected for this role" &&
          status !== "Role closed" &&
          status !== "Hired",
        next_step: nextStepHint(status),
      };
    });
    return { applications: shaped };
  });

function nextStepHint(status: CandidateSafeStatus): string | null {
  switch (status) {
    case "Application received":
      return "We'll review your details and get back to you.";
    case "Information being reviewed":
      return "The team is looking over your submission.";
    case "Additional information requested":
      return "Please check your messages and reply when you can.";
    case "Under consideration":
      return "Your profile is with the hiring team.";
    case "Shortlisted":
      return "You've been shortlisted. Expect to hear about interviews soon.";
    case "Interview requested":
      return "An interview has been requested. Watch your messages for scheduling.";
    case "Decision pending":
      return "The hiring team is finalizing their decision.";
    case "Hired":
      return "Congratulations — welcome aboard.";
    case "Not selected for this role":
    case "Role closed":
    case "Withdrawn":
      return null;
  }
}

export const getMyApplication = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const supabase = context.supabase as AnyRow;
    const { data: cp } = await supabase
      .from("candidate_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!cp) throw new Error("No candidate profile");

    const { data: a, error } = await supabase
      .from("applications")
      .select(
        `id, position_id, status, applied_at, updated_at, withdrawn_at, candidate_profile_id,
         positions:position_id ( id, title, description, status, organization_id, employment_type, work_model, location, organizations:organization_id ( id, name ) ),
         candidate_matches ( id, stage, client_visibility, updated_at,
           client_decisions ( decision, feedback, created_at ) )`,
      )
      .eq("id", data.id)
      .eq("candidate_profile_id", cp.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!a) throw new Error("Not found");

    const pos = a.positions ?? {};
    const org = pos.organizations ?? {};
    const visibleMatch = (asArray(a.candidate_matches)).find(
      (m: AnyRow) => m.client_visibility === "visible",
    );
    const infoRequested = (asArray(a.candidate_matches)).some((m: AnyRow) =>
      (asArray(m.client_decisions)).some(
        (d: AnyRow) => d.decision === "request_information",
      ),
    );
    const status = mapStatus({
      applicationStatus: a.status,
      positionStatus: pos.status ?? "active",
      visibleStage: visibleMatch?.stage ?? null,
      infoRequested,
    });
    const events: { at: string; label: string }[] = [
      { at: a.applied_at, label: "Application received" },
    ];
    for (const m of asArray(a.candidate_matches)) {
      for (const d of asArray(m.client_decisions)) {
        const label = decisionLabel(d.decision);
        if (label) events.push({ at: d.created_at, label });
      }
    }
    if (a.withdrawn_at) events.push({ at: a.withdrawn_at, label: "Withdrawn" });
    events.sort((x, y) => x.at.localeCompare(y.at));
    return {
      id: a.id,
      role_title: pos.title ?? "Role",
      role_description: pos.description ?? "",
      company: org.name ?? null,
      employment_type: pos.employment_type ?? null,
      work_model: pos.work_model ?? null,
      location: pos.location ?? null,
      applied_at: a.applied_at,
      status,
      next_step: nextStepHint(status),
      can_withdraw:
        status !== "Withdrawn" &&
        status !== "Not selected for this role" &&
        status !== "Role closed" &&
        status !== "Hired",
      events,
    };
  });

function decisionLabel(decision: string): string | null {
  switch (decision) {
    case "shortlist":
      return "Shortlisted";
    case "request_interview":
      return "Interview requested";
    case "request_information":
      return "Additional information requested";
    case "not_moving_forward":
      return "Not moving forward";
    case "hire":
      return "Hired";
    default:
      return null;
  }
}

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

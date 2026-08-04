/**
 * Server-only data access for the public candidate status experience.
 * Verified by reference (application id prefix) + email on every call.
 * Never returns scores, evidence, reviewer notes or other candidates.
 */
import {
  buildJourney,
  resolveCandidateState,
  type JourneyStep,
  type StatusInputs,
} from "./apply-status-model";
import type { CandidateStateKey } from "./candidate-transparency";

export interface PublicInfoRequest {
  id: string;
  prompt: string;
  created_at: string;
  due_at: string | null;
  expired: boolean;
}

export interface PublicApplicationStatus {
  application_id: string;
  reference: string;
  applied_at: string;
  last_update: string | null;
  position_title: string | null;
  organization_name: string | null;
  candidate_first_name: string | null;
  state: CandidateStateKey;
  steps: JourneyStep[];
  open_requests: PublicInfoRequest[];
  next_interview_at: string | null;
  can_withdraw: boolean;
  withdrawn: boolean;
}

type Verified = { id: string; candidate_profile_id: string; email: string };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function findApplication(reference: string, email: string) {
  const db = await admin();
  const prefix = reference.toLowerCase();
  const { data: rows, error } = await db
    .from("applications")
    .select(
      "id,applied_at,updated_at,status,withdrawn_at,candidate_profile_id," +
        "positions(title,status,organizations(name))," +
        "candidate_profiles!inner(full_name,email)," +
        "candidate_matches(stage,client_visibility,updated_at,interviews(status,scheduled_at))",
    )
    .ilike("candidate_profiles.email", email)
    .limit(50);
  if (error || !rows) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = rows as any[];
  const app = list.find((r) => {
    if (String(r.id).replace(/-/g, "").slice(0, 6).toLowerCase() !== prefix) return false;
    const cp = r.candidate_profiles as unknown as { email?: string } | null;
    return (cp?.email ?? "").trim().toLowerCase() === email;
  });
  return app ?? null;
}

export async function loadPublicStatus(
  reference: string,
  email: string,
): Promise<PublicApplicationStatus | null> {
  const app = await findApplication(reference, email);
  if (!app) return null;
  const db = await admin();

  const pos = app.positions as unknown as {
    title?: string | null;
    status?: string | null;
    organizations?: { name?: string | null } | null;
  } | null;
  const cp = app.candidate_profiles as unknown as { full_name?: string | null } | null;
  const matchesRaw = app.candidate_matches as unknown;
  const matches = (Array.isArray(matchesRaw) ? matchesRaw : matchesRaw ? [matchesRaw] : []) as Array<{
    stage: string | null;
    client_visibility: string | null;
    updated_at: string | null;
    interviews?: unknown;
  }>;
  const interviews = matches.flatMap((m) => {
    const iv = m.interviews;
    return (Array.isArray(iv) ? iv : iv ? [iv] : []) as Array<{
      status: string | null;
      scheduled_at: string | null;
    }>;
  });
  const live = interviews.filter((iv) => iv.status !== "cancelled");
  const nextInterview =
    live
      .filter((iv) => iv.scheduled_at)
      .map((iv) => iv.scheduled_at as string)
      .sort((a, b) => a.localeCompare(b))[0] ?? null;

  const { data: reqRows } = await db
    .from("candidate_info_requests")
    .select("id,prompt,created_at,due_at,status")
    .eq("application_id", app.id)
    .eq("status", "open")
    .order("created_at", { ascending: true });
  const open_requests: PublicInfoRequest[] = (reqRows ?? []).map((r) => ({
    id: r.id as string,
    prompt: r.prompt as string,
    created_at: r.created_at as string,
    due_at: (r.due_at as string | null) ?? null,
    expired: Boolean(r.due_at && new Date(r.due_at as string).getTime() < Date.now()),
  }));

  const visible = matches.some((m) => m.client_visibility === "visible");
  const stage = matches[0]?.stage ?? null;

  // A failed, exhausted processing job is the only thing that puts a
  // candidate into "support needed" — never a normal in-flight run.
  const { data: failedJobs } = await db
    .from("processing_jobs")
    .select("id,status,attempts")
    .eq("entity_type", "applications")
    .eq("entity_id", app.id)
    .eq("status", "failed")
    .limit(1);
  const needsSupport = (failedJobs ?? []).length > 0;

  const inputs: StatusInputs = {
    applicationStatus: app.status as string,
    withdrawnAt: (app.withdrawn_at as string | null) ?? null,
    positionStatus: pos?.status ?? null,
    matchStage: stage,
    matchVisible: visible,
    hasOpenInfoRequest: open_requests.some((r) => !r.expired),
    interviewScheduled: Boolean(nextInterview),
    interviewRequested: live.length > 0,
    needsSupport,
  };
  const state = resolveCandidateState(inputs);

  const lastUpdate =
    [
      app.updated_at as string | null,
      ...matches.map((m) => m.updated_at),
      ...open_requests.map((r) => r.created_at),
    ]
      .filter(Boolean)
      .sort((a, b) => String(b).localeCompare(String(a)))[0] ?? null;

  return {
    application_id: app.id as string,
    reference: reference.toUpperCase(),
    applied_at: app.applied_at as string,
    last_update: lastUpdate,
    position_title: pos?.title ?? null,
    organization_name: pos?.organizations?.name ?? null,
    candidate_first_name: (cp?.full_name ?? "").trim().split(" ")[0] || null,
    state,
    steps: buildJourney(state, inputs),
    open_requests,
    next_interview_at: nextInterview,
    can_withdraw: state !== "withdrawn" && state !== "decision_made" && state !== "role_closed",
    withdrawn: Boolean(app.withdrawn_at),
  };
}

async function verify(reference: string, email: string): Promise<Verified | null> {
  const app = await findApplication(reference, email);
  if (!app) return null;
  return {
    id: app.id as string,
    candidate_profile_id: app.candidate_profile_id as string,
    email,
  };
}

export async function withdrawByReference(
  reference: string,
  email: string,
): Promise<{ ok: boolean; message: string }> {
  const v = await verify(reference, email);
  if (!v) return { ok: false, message: "We couldn't match that reference and email." };
  const db = await admin();
  const { data: current } = await db
    .from("applications")
    .select("status,withdrawn_at")
    .eq("id", v.id)
    .maybeSingle();
  if (!current) return { ok: false, message: "We couldn't find that application." };
  if (current.withdrawn_at) return { ok: true, message: "This application is already withdrawn." };
  if (["rejected", "archived"].includes(current.status as string)) {
    return { ok: false, message: "This application is already closed." };
  }

  const { error } = await db
    .from("applications")
    .update({ status: "withdrawn", withdrawn_at: new Date().toISOString() })
    .eq("id", v.id);
  if (error) return { ok: false, message: "We couldn't withdraw it just now. Please email us." };

  await db
    .from("candidate_matches")
    .update({ client_visibility: "hidden" })
    .eq("application_id", v.id);
  await db.from("candidate_info_requests").update({ status: "closed" }).eq("application_id", v.id);
  await db.from("audit_events").insert({
    entity_type: "applications",
    entity_id: v.id,
    action: "candidate_withdraw_public",
  });
  return {
    ok: true,
    message: "Your application is withdrawn. We've stopped the review and told the hiring team.",
  };
}

export async function answerInfoRequestByReference(input: {
  reference: string;
  email: string;
  requestId: string;
  response: string;
}): Promise<{ ok: boolean; message: string }> {
  const v = await verify(input.reference, input.email);
  if (!v) return { ok: false, message: "We couldn't match that reference and email." };
  const db = await admin();
  const { data: req } = await db
    .from("candidate_info_requests")
    .select("id,status,application_id")
    .eq("id", input.requestId)
    .eq("application_id", v.id)
    .maybeSingle();
  if (!req) return { ok: false, message: "We couldn't find that question." };
  if (req.status !== "open") return { ok: false, message: "This question is already answered." };

  const { error } = await db
    .from("candidate_info_requests")
    .update({
      response: input.response,
      responded_at: new Date().toISOString(),
      status: "answered",
    })
    .eq("id", req.id);
  if (error) return { ok: false, message: "We couldn't save your reply. Please email us." };

  await db.from("audit_events").insert({
    entity_type: "candidate_info_requests",
    entity_id: req.id as string,
    action: "candidate_info_response_public",
  });
  return { ok: true, message: "Thanks — your reply is with the team." };
}

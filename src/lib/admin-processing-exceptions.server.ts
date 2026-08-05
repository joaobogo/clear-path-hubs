/**
 * Processing pipeline exception board.
 *
 * Everything here is derived from real `processing_jobs` rows. There is no new
 * queue: an "exception" is a job the existing worker either failed, could not
 * pick up, or exhausted its attempt ceiling on. Retry only re-arms a row (or
 * re-enqueues the canonical `parse_and_score` job) so `drainApplicationJobs`
 * claims it exactly the way it claims a fresh job.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
type Admin = SupabaseClient<never, never, never>;

/** Mirrors JOB_MAX_ATTEMPTS in pipeline-runner.server.ts. */
export const JOB_ATTEMPT_CEILING = 3;
/** A queued job older than this has not been claimed by any worker pass. */
export const STUCK_QUEUED_MINUTES = 15;
/** How far back the board looks. */
export const EXCEPTION_WINDOW_DAYS = 7;

export const PERMANENT_FAIL_CODE = "permanently_failed";
export const RETRY_ACTION = "processing_job.retried";
export const PERMANENT_FAIL_ACTION = "processing_job.marked_permanently_failed";

export type ExceptionReason = "failed" | "stuck_queued" | "attempt_ceiling";

export const REASON_LABEL: Record<ExceptionReason, string> = {
  failed: "Failed",
  stuck_queued: `Queued longer than ${STUCK_QUEUED_MINUTES} minutes`,
  attempt_ceiling: `Attempts at the ceiling (${JOB_ATTEMPT_CEILING})`,
};

export type ExceptionRow = {
  job_id: string;
  job_type: string;
  status: string;
  entity_type: string;
  entity_id: string;
  attempts: number;
  error_code: string | null;
  error_message: string | null;
  trace_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  age_minutes: number;
  reasons: ExceptionReason[];
  retryable: boolean;
  permanently_failed: boolean;
  permanent_reason: string | null;
  match_id: string | null;
  candidate_name: string | null;
  position_id: string | null;
  position_title: string | null;
  organization_id: string | null;
  organization_name: string | null;
  processing_state: string | null;
};

export type ExceptionBoard = {
  generated_at: string;
  window_days: number;
  active: ExceptionRow[];
  permanent: ExceptionRow[];
  scoring_orphans: number;
  rules: {
    attempt_ceiling: number;
    stuck_queued_minutes: number;
    window_days: number;
  };
};

function minutesSince(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

function classify(job: Any): ExceptionReason[] {
  const reasons: ExceptionReason[] = [];
  if (job.status === "failed") reasons.push("failed");
  if (job.status === "queued" && minutesSince(job.created_at) >= STUCK_QUEUED_MINUTES)
    reasons.push("stuck_queued");
  if (Number(job.attempts ?? 0) >= JOB_ATTEMPT_CEILING && job.status !== "completed")
    reasons.push("attempt_ceiling");
  return reasons;
}

/**
 * Load the board. Active rows are live exceptions; permanent rows are jobs a
 * staff member closed with a written reason and stay listed as history.
 */
export async function loadExceptionBoard(admin: Admin): Promise<ExceptionBoard> {
  const s = admin as never as { from: (t: string) => Any };
  const since = new Date(Date.now() - EXCEPTION_WINDOW_DAYS * 86400_000).toISOString();

  const jobsRes = await s
    .from("processing_jobs")
    .select(
      "id, job_type, status, entity_type, entity_id, attempts, error_code, error_message, trace_id, created_at, started_at, completed_at",
    )
    .gte("created_at", since)
    .in("status", ["queued", "running", "failed", "cancelled"])
    .order("created_at", { ascending: false })
    .limit(500);
  if (jobsRes.error) throw new Error(jobsRes.error.message);
  const jobs = (jobsRes.data ?? []) as Any[];

  const permanentRows = jobs.filter(
    (j) => j.status === "cancelled" && j.error_code === PERMANENT_FAIL_CODE,
  );
  const candidateRows = jobs.filter(
    (j) => !(j.status === "cancelled" && j.error_code === PERMANENT_FAIL_CODE),
  );
  const activeRows = candidateRows.filter((j) => classify(j).length > 0);

  const relevant = [...activeRows, ...permanentRows];

  // Resolve entity context in two hops: applications → matches, or match ids.
  const applicationIds = relevant
    .filter((j) => j.entity_type === "application")
    .map((j) => j.entity_id as string);
  const directMatchIds = relevant
    .filter((j) => j.entity_type === "candidate_match")
    .map((j) => j.entity_id as string);

  const matchByApplication = new Map<string, Any>();
  const matchById = new Map<string, Any>();

  const select =
    "id, application_id, position_id, organization_id, processing_state, candidate_profiles(full_name), positions(id, title, organization_id, organizations(name))";

  if (applicationIds.length) {
    const res = await s
      .from("candidate_matches")
      .select(select)
      .in("application_id", Array.from(new Set(applicationIds)));
    if (res.error) throw new Error(res.error.message);
    for (const m of (res.data ?? []) as Any[]) {
      if (m.application_id) matchByApplication.set(m.application_id, m);
      matchById.set(m.id, m);
    }
  }
  if (directMatchIds.length) {
    const res = await s
      .from("candidate_matches")
      .select(select)
      .in("id", Array.from(new Set(directMatchIds)));
    if (res.error) throw new Error(res.error.message);
    for (const m of (res.data ?? []) as Any[]) matchById.set(m.id, m);
  }

  const orphansRes = await s
    .from("scoring_orphans")
    .select("id", { count: "exact", head: true })
    .is("resolved_at", null);
  const scoringOrphans = Number(orphansRes.count ?? 0);

  const shape = (job: Any): ExceptionRow => {
    const match =
      job.entity_type === "application"
        ? matchByApplication.get(job.entity_id)
        : matchById.get(job.entity_id);
    const position = Array.isArray(match?.positions) ? match?.positions[0] : match?.positions;
    const org = Array.isArray(position?.organizations)
      ? position?.organizations[0]
      : position?.organizations;
    const profile = Array.isArray(match?.candidate_profiles)
      ? match?.candidate_profiles[0]
      : match?.candidate_profiles;
    const permanently = job.status === "cancelled" && job.error_code === PERMANENT_FAIL_CODE;
    return {
      job_id: job.id,
      job_type: job.job_type,
      status: job.status,
      entity_type: job.entity_type,
      entity_id: job.entity_id,
      attempts: Number(job.attempts ?? 0),
      error_code: job.error_code ?? null,
      error_message: job.error_message ?? null,
      trace_id: job.trace_id ?? null,
      created_at: job.created_at,
      started_at: job.started_at ?? null,
      completed_at: job.completed_at ?? null,
      age_minutes: minutesSince(job.created_at),
      reasons: permanently ? [] : classify(job),
      retryable: !permanently && !!(match?.application_id ?? (job.entity_type === "application" ? job.entity_id : null)),
      permanently_failed: permanently,
      permanent_reason: permanently ? (job.error_message ?? null) : null,
      match_id: match?.id ?? null,
      candidate_name: profile?.full_name ?? null,
      position_id: position?.id ?? match?.position_id ?? null,
      position_title: position?.title ?? null,
      organization_id: org ? (position?.organization_id ?? match?.organization_id ?? null) : (match?.organization_id ?? null),
      organization_name: org?.name ?? null,
      processing_state: match?.processing_state ?? null,
    };
  };

  return {
    generated_at: new Date().toISOString(),
    window_days: EXCEPTION_WINDOW_DAYS,
    active: activeRows.map(shape),
    permanent: permanentRows.map(shape),
    scoring_orphans: scoringOrphans,
    rules: {
      attempt_ceiling: JOB_ATTEMPT_CEILING,
      stuck_queued_minutes: STUCK_QUEUED_MINUTES,
      window_days: EXCEPTION_WINDOW_DAYS,
    },
  };
}

export type RetryOutcome = {
  job_id: string;
  result: "requeued" | "already_active" | "skipped";
  detail: string;
};

/**
 * Re-arm one job for the existing worker.
 *
 * `parse_and_score` application jobs are set back to `queued` with attempts
 * reset, guarded on the status we read so a worker mid-claim always wins.
 * Any other job type re-enqueues the canonical `parse_and_score` job for the
 * owning application — the only durable entry point the worker consumes. The
 * partial unique index on (entity_id, job_type) WHERE status IN (queued,
 * running) is what stops duplicates; a conflict is reported, never forced.
 */
export async function retryProcessingJob(
  admin: Admin,
  jobId: string,
  actorUserId: string,
): Promise<RetryOutcome> {
  const s = admin as never as { from: (t: string) => Any };

  const jobRes = await s
    .from("processing_jobs")
    .select("id, job_type, status, entity_type, entity_id, attempts, error_code")
    .eq("id", jobId)
    .maybeSingle();
  if (jobRes.error) throw new Error(jobRes.error.message);
  const job = jobRes.data as Any;
  if (!job) throw new Error("Job not found");
  if (job.status === "cancelled" && job.error_code === PERMANENT_FAIL_CODE)
    return { job_id: jobId, result: "skipped", detail: "Marked permanently failed — retry blocked." };
  if (job.status === "running")
    return { job_id: jobId, result: "already_active", detail: "A worker is running this job now." };

  const applicationId = await resolveApplicationId(s, job);
  if (!applicationId)
    return {
      job_id: jobId,
      result: "skipped",
      detail: "No application row behind this job — nothing for the worker to consume.",
    };

  // An already queued/running canonical job means the worker will pick the
  // work up on its own pass; re-arming would collide with the unique index.
  const activeRes = await s
    .from("processing_jobs")
    .select("id, status")
    .eq("entity_id", applicationId)
    .eq("job_type", "parse_and_score")
    .in("status", ["queued", "running"])
    .maybeSingle();
  if (activeRes.error) throw new Error(activeRes.error.message);

  if (activeRes.data && activeRes.data.id !== jobId) {
    return {
      job_id: jobId,
      result: "already_active",
      detail: `Already ${activeRes.data.status} as job ${String(activeRes.data.id).slice(0, 8)} — the worker will drain it.`,
    };
  }

  if (job.job_type === "parse_and_score" && job.entity_type === "application") {
    const upd = await s
      .from("processing_jobs")
      .update({
        status: "queued",
        attempts: 0,
        error_code: null,
        error_message: null,
        started_at: null,
        completed_at: null,
      })
      .eq("id", jobId)
      .eq("status", job.status)
      .select("id")
      .maybeSingle();
    if (upd.error) throw new Error(upd.error.message);
    if (!upd.data)
      return {
        job_id: jobId,
        result: "already_active",
        detail: "Job changed state while retrying — leaving it to the worker.",
      };
  } else {
    const ins = await s
      .from("processing_jobs")
      .insert({
        entity_type: "application",
        entity_id: applicationId,
        job_type: "parse_and_score",
        status: "queued",
        attempts: 0,
      })
      .select("id")
      .maybeSingle();
    if (ins.error) {
      if (String(ins.error.code) === "23505")
        return {
          job_id: jobId,
          result: "already_active",
          detail: "A queued job already exists for this application.",
        };
      throw new Error(ins.error.message);
    }
  }

  await writeAudit(s, {
    action: RETRY_ACTION,
    jobId,
    applicationId,
    actorUserId,
    after: { retried_at: new Date().toISOString(), job_type: job.job_type },
  });

  return { job_id: jobId, result: "requeued", detail: "Re-enqueued for the existing worker." };
}

/** Retry every active exception attached to a position. */
export async function retryPositionExceptions(
  admin: Admin,
  positionId: string,
  actorUserId: string,
): Promise<RetryOutcome[]> {
  const board = await loadExceptionBoard(admin);
  const rows = board.active.filter((r) => r.position_id === positionId && r.retryable);
  const out: RetryOutcome[] = [];
  for (const row of rows) {
    try {
      out.push(await retryProcessingJob(admin, row.job_id, actorUserId));
    } catch (e) {
      out.push({
        job_id: row.job_id,
        result: "skipped",
        detail: e instanceof Error ? e.message : "Retry failed",
      });
    }
  }
  return out;
}

/**
 * Close a job as permanently failed with a written reason. The row stays in the
 * table and on the board's history list; no pipeline state is edited.
 */
export async function markJobPermanentlyFailed(
  admin: Admin,
  jobId: string,
  reason: string,
  actorUserId: string,
): Promise<{ ok: true }> {
  const trimmed = reason.trim();
  if (trimmed.length < 10) throw new Error("A reason of at least 10 characters is required.");

  const s = admin as never as { from: (t: string) => Any };
  const jobRes = await s
    .from("processing_jobs")
    .select("id, status, entity_type, entity_id, job_type, error_code, error_message")
    .eq("id", jobId)
    .maybeSingle();
  if (jobRes.error) throw new Error(jobRes.error.message);
  const job = jobRes.data as Any;
  if (!job) throw new Error("Job not found");
  if (job.status === "running")
    throw new Error("A worker is running this job — wait for it to finish first.");

  const upd = await s
    .from("processing_jobs")
    .update({
      status: "cancelled",
      error_code: PERMANENT_FAIL_CODE,
      error_message: trimmed.slice(0, 1000),
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", job.status)
    .select("id")
    .maybeSingle();
  if (upd.error) throw new Error(upd.error.message);
  if (!upd.data) throw new Error("Job changed state while closing it — reload the board.");

  await writeAudit(s, {
    action: PERMANENT_FAIL_ACTION,
    jobId,
    applicationId: job.entity_type === "application" ? (job.entity_id as string) : null,
    actorUserId,
    before: { status: job.status, error_code: job.error_code ?? null },
    after: { status: "cancelled", reason: trimmed },
  });

  return { ok: true };
}

async function resolveApplicationId(
  s: { from: (t: string) => Any },
  job: Any,
): Promise<string | null> {
  if (job.entity_type === "application") return job.entity_id as string;
  if (job.entity_type === "candidate_match") {
    const res = await s
      .from("candidate_matches")
      .select("application_id")
      .eq("id", job.entity_id)
      .maybeSingle();
    if (res.error) throw new Error(res.error.message);
    return (res.data?.application_id as string) ?? null;
  }
  return null;
}

async function writeAudit(
  s: { from: (t: string) => Any },
  args: {
    action: string;
    jobId: string;
    applicationId: string | null;
    actorUserId: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  },
) {
  let organizationId: string | null = null;
  if (args.applicationId) {
    const res = await s
      .from("candidate_matches")
      .select("organization_id")
      .eq("application_id", args.applicationId)
      .maybeSingle();
    organizationId = (res.data?.organization_id as string) ?? null;
  }
  await s.from("audit_events").insert({
    entity_type: "processing_job",
    entity_id: args.jobId,
    organization_id: organizationId,
    action: args.action,
    actor_user_id: args.actorUserId,
    before_state: args.before ?? null,
    after_state: args.after ?? null,
  });
}

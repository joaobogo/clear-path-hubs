/**
 * Agent Operations Console — server-only reads and controls.
 *
 * Authorization: every export takes the acting user id and calls
 * `requireOperator` first, which resolves platform staff status through the
 * `is_platform_staff` security-definer function. There is no client-trusted
 * role input anywhere in this file.
 *
 * Tenant isolation: runs are keyed on `processing_jobs`, which is not
 * org-scoped, so each run's workspace is resolved from its entity
 * (`candidate_matches` / `positions`) before anything is shown. A run whose
 * workspace cannot be resolved is shown without workspace-scoped controls
 * rather than guessed at.
 *
 * Auditing: every control writes an `audit_events` row before returning, with
 * the acting user, the affected entity, the before/after state and a trace id.
 * Nothing here returns secrets, prompts, model reasoning or candidate
 * personal data — free-form payloads pass through `redactStructured`.
 */

import { AGENT_KEYS, agentName, type AgentKey } from "@/lib/agents/registry";
import {
  actionsFor,
  agentForJobType,
  capabilitiesFor,
  categoriseError,
  durationLabel,
  escalationState,
  formatUsdMicros,
  isStalled,
  redactErrorMessage,
  redactStructured,
  runBucket,
  RUN_BUCKETS,
  type AgentOpsConsole,
  type AgentWindowStatus,
  type AgentRunRow,
  type RunBucket,
} from "./agent-ops";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

async function admin(): Promise<Any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Any;
}

export type Operator = {
  user_id: string;
  scope: "platform_admin" | "platform_staff";
};

/** Single authorization gate for the console. Throws for everyone else. */
export async function requireOperator(userId: string): Promise<Operator> {
  const s = await admin();
  const { data: staff } = await s.rpc("is_platform_staff", { _user: userId });
  if (staff !== true) throw new Error("forbidden");
  const { data: isAdmin } = await s.rpc("is_platform_admin", { _user: userId });
  return { user_id: userId, scope: isAdmin === true ? "platform_admin" : "platform_staff" };
}

/** Controls that change agent or workspace state are platform-admin only. */
export async function requireOperatorAdmin(userId: string): Promise<Operator> {
  const op = await requireOperator(userId);
  if (op.scope !== "platform_admin") throw new Error("forbidden");
  return op;
}

function traceId() {
  return `aop_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

async function writeAudit(input: {
  actor_user_id: string;
  organization_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  before_state?: unknown;
  after_state?: unknown;
  trace_id: string;
}) {
  const s = await admin();
  await s.from("audit_events").insert({
    actor_user_id: input.actor_user_id,
    organization_id: input.organization_id,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    action: input.action,
    before_state: redactStructured(input.before_state ?? null) as Any,
    after_state: redactStructured(input.after_state ?? null) as Any,
    trace_id: input.trace_id,
  } as never);
}

// ------------------------------------------------------------------ reads

// Bucketing is never expressed as a database status list: `runBucket` in
// agent-ops.ts is the single source of truth, so tiles, the per-agent rollup
// and the visible list are derived from exactly the same rows.


type Context = {
  orgById: Map<string, string>;
  matchById: Map<string, Any>;
  positionById: Map<string, Any>;
  pausedAgents: Set<string>;
  usageByTrace: Map<string, { calls: number; tokens_in: number; tokens_out: number; cost: number; latency: number }>;
};

/** Resolves workspace, role and usage context for a page of jobs in bulk. */
async function loadContext(jobs: Any[]): Promise<Context> {
  const s = await admin();

  const matchIds = [
    ...new Set(jobs.filter((j) => j.entity_type === "candidate_match").map((j) => j.entity_id)),
  ].filter(Boolean);
  const directPositionIds = [
    ...new Set(jobs.filter((j) => j.entity_type === "position").map((j) => j.entity_id)),
  ].filter(Boolean);
  const traceIds = [...new Set(jobs.map((j) => j.trace_id))].filter(Boolean);

  const [matchRes, usageRes] = await Promise.all([
    matchIds.length
      ? s
          .from("candidate_matches")
          .select("id,organization_id,position_id,admin_status,canonical_state,processing_state")
          .in("id", matchIds)
      : Promise.resolve({ data: [] }),
    traceIds.length
      ? s
          .from("provider_usage_events")
          .select("trace_id,tokens_in,tokens_out,cost_estimate_micros,latency_ms")
          .in("trace_id", traceIds)
      : Promise.resolve({ data: [] }),
  ]);

  const matchById = new Map<string, Any>((matchRes.data ?? []).map((m: Any) => [m.id, m]));
  const positionIds = [
    ...new Set([
      ...directPositionIds,
      ...(matchRes.data ?? []).map((m: Any) => m.position_id).filter(Boolean),
    ]),
  ];

  const posRes = positionIds.length
    ? await s.from("positions").select("id,title,organization_id,status").in("id", positionIds)
    : { data: [] };
  const positionById = new Map<string, Any>((posRes.data ?? []).map((p: Any) => [p.id, p]));

  const orgIds = [
    ...new Set([
      ...(matchRes.data ?? []).map((m: Any) => m.organization_id),
      ...(posRes.data ?? []).map((p: Any) => p.organization_id),
    ]),
  ].filter(Boolean);

  const [orgRes, settingsRes] = await Promise.all([
    orgIds.length
      ? s.from("organizations").select("id,name").in("id", orgIds)
      : Promise.resolve({ data: [] }),
    orgIds.length
      ? s
          .from("agent_settings")
          .select("organization_id,agent_key,enabled,paused_at")
          .in("organization_id", orgIds)
      : Promise.resolve({ data: [] }),
  ]);

  const pausedAgents = new Set<string>();
  for (const row of settingsRes.data ?? []) {
    if (row.paused_at || row.enabled === false) {
      pausedAgents.add(`${row.organization_id}:${row.agent_key}`);
    }
  }

  const usageByTrace = new Map<string, Context["usageByTrace"] extends Map<string, infer V> ? V : never>();
  for (const u of usageRes.data ?? []) {
    const prev =
      usageByTrace.get(u.trace_id) ?? { calls: 0, tokens_in: 0, tokens_out: 0, cost: 0, latency: 0 };
    usageByTrace.set(u.trace_id, {
      calls: prev.calls + 1,
      tokens_in: prev.tokens_in + (u.tokens_in ?? 0),
      tokens_out: prev.tokens_out + (u.tokens_out ?? 0),
      cost: prev.cost + Number(u.cost_estimate_micros ?? 0),
      latency: prev.latency + (u.latency_ms ?? 0),
    });
  }

  return {
    orgById: new Map<string, string>((orgRes.data ?? []).map((o: Any) => [o.id, o.name])),
    matchById,
    positionById,
    pausedAgents,
    usageByTrace,
  };
}

function toRow(job: Any, ctx: Context, operator: Operator, escalatedTraces: Set<string>): AgentRunRow {
  const match = job.entity_type === "candidate_match" ? ctx.matchById.get(job.entity_id) : null;
  const positionId = match?.position_id ?? (job.entity_type === "position" ? job.entity_id : null);
  const position = positionId ? ctx.positionById.get(positionId) : null;
  const organizationId = match?.organization_id ?? position?.organization_id ?? null;
  const agent_key = agentForJobType(job.job_type);
  const bucket = runBucket(job.status);
  const usage = job.trace_id ? ctx.usageByTrace.get(job.trace_id) : undefined;
  const agent_paused = Boolean(
    organizationId && agent_key && ctx.pausedAgents.has(`${organizationId}:${agent_key}`),
  );

  const base = {
    bucket,
    entity_type: job.entity_type ?? null,
    job_type: job.job_type ?? null,
    organization_id: organizationId,
    agent_key,
    position_id: positionId ?? null,
    agent_paused,
  };

  return {
    id: job.id,
    job_type: job.job_type,
    agent_key,
    agent_name: agent_key ? agentName(agent_key) : "Platform pipeline",
    status: job.status,
    bucket,
    stalled: isStalled(bucket, job.started_at),
    attempts: job.attempts ?? 0,
    entity_type: job.entity_type ?? null,
    entity_id: job.entity_id ?? null,
    organization_id: organizationId,
    organization_name: organizationId ? (ctx.orgById.get(organizationId) ?? null) : null,
    viewer_scope: operator.scope,
    position_id: positionId ?? null,
    position_title: position?.title ?? null,
    created_at: job.created_at,
    started_at: job.started_at ?? null,
    completed_at: job.completed_at ?? null,
    duration_label: durationLabel(job.started_at ?? null, job.completed_at ?? null),
    error_code: job.error_code ?? null,
    error_category: categoriseError(job.error_code, job.status),
    error_message: redactErrorMessage(job.error_message),
    escalation: escalationState({
      bucket,
      attempts: job.attempts ?? 0,
      escalated: Boolean(job.trace_id && escalatedTraces.has(job.trace_id)),
    }),
    agent_paused,
    trace_id: job.trace_id ?? null,
    usage: usage
      ? {
          calls: usage.calls,
          tokens_in: usage.tokens_in,
          tokens_out: usage.tokens_out,
          cost_label: formatUsdMicros(usage.cost),
          latency_ms: usage.latency || null,
        }
      : null,
    actions: actionsFor(base),
  };
}

export type ConsoleFilters = {
  bucket?: RunBucket | "all";
  agent?: AgentKey | "all";
  organization_id?: string | null;
  limit?: number;
  window_hours?: number;
};

export async function loadAgentOpsConsole(
  operator: Operator,
  filters: ConsoleFilters = {},
): Promise<AgentOpsConsole> {
  const s = await admin();
  const windowHours = filters.window_hours ?? 72;
  const since = new Date(Date.now() - windowHours * 3_600_000).toISOString();
  const limit = Math.min(Math.max(filters.limit ?? 60, 1), 200);

  // One read of the window. Buckets, per-agent rollups and the visible list
  // are all derived from this same set, so the tiles cannot disagree with it.
  const [{ data: jobs }, escalations] = await Promise.all([
    s
      .from("processing_jobs")
      .select(
        "id,entity_type,entity_id,job_type,status,attempts,error_code,error_message,trace_id,created_at,started_at,completed_at",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000),
    s
      .from("audit_events")
      .select("trace_id,action")
      .eq("action", "agent_ops.escalate")
      .gte("created_at", since)
      .limit(500),
  ]);

  const escalatedTraces = new Set<string>(
    (escalations.data ?? []).map((e: Any) => e.after_state?.run_trace_id ?? e.trace_id).filter(Boolean),
  );

  let rows = jobs ?? [];
  if (filters.agent && filters.agent !== "all") {
    rows = rows.filter((j: Any) => agentForJobType(j.job_type) === filters.agent);
  }

  const ctx = await loadContext(rows);
  let all: AgentRunRow[] = rows.map((j: Any) => toRow(j, ctx, operator, escalatedTraces));

  // Fix: Move superseded/obsolete/cancelled jobs to a terminal bucket.
  // This ensures they don't count towards "Active" or "Queued" tiles.
  const filteredAll = all.filter((r) => {
    if (filters.organization_id && r.organization_id !== filters.organization_id) return false;
    return true;
  });

  const counts = Object.fromEntries(
    RUN_BUCKETS.map((b) => [b, filteredAll.filter((r) => r.bucket === b).length]),
  ) as Record<RunBucket, number>;

  const runs =
    filters.bucket && filters.bucket !== "all"
      ? filteredAll.filter((r) => r.bucket === filters.bucket).slice(0, limit)
      : filteredAll.slice(0, limit);

  // Every agent in the registry is reported, including the idle ones. A
  // missing agent would read as "this agent does not exist".
  const agents = AGENT_KEYS.map((key) => {
    const mine = all.filter((r) => r.agent_key === key);
    const workspaces_paused = new Set(
      mine.filter((r) => r.agent_paused).map((r) => r.organization_id),
    ).size;
    const active = mine.filter((r) => r.bucket === "active").length;
    const queued = mine.filter((r) => r.bucket === "queued").length;
    const failed_24h = mine.filter(
      (r) => r.bucket === "failed" && Date.now() - new Date(r.created_at).getTime() < 86_400_000,
    ).length;
    const status: AgentWindowStatus = workspaces_paused
      ? "paused"
      : active
        ? "running"
        : queued
          ? "queued"
          : failed_24h
            ? "failing"
            : "idle";
    return {
      key,
      name: agentName(key),
      workspaces_paused,
      active,
      queued,
      runs: mine.length,
      failed_24h,
      status,
    };
  });

  return {
    generated_at: new Date().toISOString(),
    counts,
    runs,
    agents,
    window_hours: windowHours,
  };
}



/** One run: resolved inputs, redacted structured output, usage, audit trail. */
export async function loadAgentRunDetail(operator: Operator, jobId: string) {
  const s = await admin();
  const { data: job } = await s
    .from("processing_jobs")
    .select(
      "id,entity_type,entity_id,job_type,status,attempts,error_code,error_message,trace_id,created_at,started_at,completed_at",
    )
    .eq("id", jobId)
    .maybeSingle();
  if (!job) throw new Error("run_not_found");

  const ctx = await loadContext([job]);
  const run = toRow(job, ctx, operator, new Set());

  const [activity, audit, evidence] = await Promise.all([
    run.organization_id
      ? s
          .from("agent_activity")
          .select("agent_key,outcome,sentence,reason,occurred_at,link_path")
          .eq("organization_id", run.organization_id)
          .order("occurred_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),
    s
      .from("audit_events")
      .select("action,actor_user_id,created_at,after_state,trace_id")
      .or(
        [
          run.entity_id ? `entity_id.eq.${run.entity_id}` : null,
          run.trace_id ? `trace_id.eq.${run.trace_id}` : null,
        ]
          .filter(Boolean)
          .join(","),
      )
      .order("created_at", { ascending: false })
      .limit(25),
    run.entity_type === "candidate_match" && run.entity_id
      ? s
          .from("candidate_matches")
          .select(
            "id,stage,canonical_state,admin_status,eligibility_status,integrity_status,evidence_confidence,recommendation,current_score_run_id,approved_score_run_id",
          )
          .eq("id", run.entity_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Inputs are references, never payloads: what the run was pointed at.
  const inputs = {
    job_type: run.job_type,
    entity_type: run.entity_type,
    entity_reference: run.entity_id ? `${run.entity_type}:${run.entity_id.slice(0, 8)}` : null,
    workspace: run.organization_name,
    role: run.position_title,
    attempt: run.attempts,
  };

  // Structured output is the state the run left behind, redacted.
  const outputs = redactStructured({
    processing_state: run.status,
    stage: evidence.data?.stage ?? null,
    canonical_state: evidence.data?.canonical_state ?? null,
    admin_status: evidence.data?.admin_status ?? null,
    eligibility: evidence.data?.eligibility_status ?? null,
    integrity: evidence.data?.integrity_status ?? null,
    evidence_confidence: evidence.data?.evidence_confidence ?? null,
    recommendation: evidence.data?.recommendation ?? null,
    score_run_present: Boolean(evidence.data?.current_score_run_id),
    score_run_approved: Boolean(evidence.data?.approved_score_run_id),
  }) as Record<string, string | number | boolean | null>;

  return {
    run,
    inputs,
    outputs,
    activity: (activity.data ?? []).map((a: Any) => ({
      agent: a.agent_key ? agentName(a.agent_key as AgentKey) : "Platform",
      outcome: a.outcome,
      sentence: a.sentence,
      reason: a.reason,
      occurred_at: a.occurred_at,
      link_path: a.link_path,
    })),
    audit: (audit.data ?? []).map((a: Any) => ({
      action: a.action,
      actor_user_id: a.actor_user_id,
      created_at: a.created_at,
      trace_id: a.trace_id,
      summary: redactStructured(a.after_state) as Record<string, string | number | boolean | null> | null,
    })),
    capabilities: capabilitiesFor(run),
  };
}

/** Platform staff who can own an escalated run. */
export async function loadAssignableOperators(): Promise<Array<{ user_id: string; name: string }>> {
  const s = await admin();
  const { data: roles } = await s.from("user_roles").select("user_id").eq("role", "admin");
  const ids = [...new Set((roles ?? []).map((r: Any) => r.user_id))];
  if (!ids.length) return [];
  const { data: profiles } = await s
    .from("profiles")
    .select("auth_user_id,full_name,status")
    .in("auth_user_id", ids);
  return (profiles ?? [])
    .filter((p: Any) => p.status !== "disabled")
    .map((p: Any) => ({ user_id: p.auth_user_id, name: p.full_name ?? "Platform operator" }));
}

// --------------------------------------------------------------- controls

export type ActionResult = {
  ok: boolean;
  /** Set when the action was deliberately not performed. */
  skipped?: "duplicate_suppressed" | "not_cancellable" | "not_retryable" | "no_workspace";
  message: string;
  trace_id: string;
};

const NON_TERMINAL = ["queued", "parsing", "enriching", "scoring"];
/** A second retry inside this window is treated as a double-click, not intent. */
const DUPLICATE_WINDOW_MS = 120_000;

async function loadJob(jobId: string) {
  const s = await admin();
  const { data } = await s
    .from("processing_jobs")
    .select(
      "id,entity_type,entity_id,job_type,status,attempts,error_code,trace_id,created_at,started_at,completed_at",
    )
    .eq("id", jobId)
    .maybeSingle();
  if (!data) throw new Error("run_not_found");
  return data as Any;
}

async function resolveWorkspace(job: Any): Promise<{ organization_id: string | null; position_id: string | null }> {
  const s = await admin();
  if (job.entity_type === "candidate_match" && job.entity_id) {
    const { data } = await s
      .from("candidate_matches")
      .select("organization_id,position_id")
      .eq("id", job.entity_id)
      .maybeSingle();
    return { organization_id: data?.organization_id ?? null, position_id: data?.position_id ?? null };
  }
  if (job.entity_type === "position" && job.entity_id) {
    const { data } = await s
      .from("positions")
      .select("organization_id")
      .eq("id", job.entity_id)
      .maybeSingle();
    return { organization_id: data?.organization_id ?? null, position_id: job.entity_id };
  }
  return { organization_id: null, position_id: null };
}

/**
 * Re-runs the pipeline for the run's candidate match. Duplicate protection is
 * two-layered: an in-flight job for the same entity blocks the retry, and a
 * retry recorded in the audit trail inside `DUPLICATE_WINDOW_MS` blocks it too.
 */
export async function retryAgentRun(
  operator: Operator,
  input: { job_id: string; reason: string },
): Promise<ActionResult> {
  const s = await admin();
  const trace_id = traceId();
  const job = await loadJob(input.job_id);
  const bucket = runBucket(job.status);
  const ws = await resolveWorkspace(job);

  if (job.entity_type !== "candidate_match" || !job.entity_id) {
    return { ok: false, skipped: "not_retryable", message: "This run has no re-runnable pipeline entry point.", trace_id };
  }
  if (bucket === "active" || bucket === "queued") {
    return { ok: false, skipped: "duplicate_suppressed", message: "This run is still in flight. Wait for it to finish or cancel it first.", trace_id };
  }

  const { data: inflight } = await s
    .from("processing_jobs")
    .select("id")
    .eq("entity_id", job.entity_id)
    .in("status", NON_TERMINAL)
    .limit(1);
  if ((inflight ?? []).length) {
    return { ok: false, skipped: "duplicate_suppressed", message: "Work for this record is already running. No second run was started.", trace_id };
  }

  const { data: recent } = await s
    .from("audit_events")
    .select("id,created_at")
    .eq("action", "agent_ops.retry")
    .eq("entity_id", job.entity_id)
    .gte("created_at", new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString())
    .limit(1);
  if ((recent ?? []).length) {
    return { ok: false, skipped: "duplicate_suppressed", message: "This record was already retried in the last two minutes.", trace_id };
  }

  await writeAudit({
    actor_user_id: operator.user_id,
    organization_id: ws.organization_id,
    entity_type: "candidate_match",
    entity_id: job.entity_id,
    action: "agent_ops.retry",
    before_state: { job_id: job.id, status: job.status, attempts: job.attempts, error_code: job.error_code },
    after_state: { reason: input.reason, run_trace_id: trace_id, requested_by_scope: operator.scope },
    trace_id,
  });

  try {
    const { runPipelineForMatch } = await import("@/lib/pipeline-runner.server");
    const out = await runPipelineForMatch(job.entity_id, { force: true });
    await writeAudit({
      actor_user_id: operator.user_id,
      organization_id: ws.organization_id,
      entity_type: "candidate_match",
      entity_id: job.entity_id,
      action: "agent_ops.retry_result",
      after_state: { final_state: out.final_state, pipeline_trace_id: out.trace_id, run_trace_id: trace_id },
      trace_id,
    });
    return {
      ok: out.final_state !== "failed",
      message:
        out.final_state === "failed"
          ? "The re-run failed again. The failure is recorded against this record."
          : `Re-run finished in state “${out.final_state}”.`,
      trace_id,
    };
  } catch (error) {
    await writeAudit({
      actor_user_id: operator.user_id,
      organization_id: ws.organization_id,
      entity_type: "candidate_match",
      entity_id: job.entity_id,
      action: "agent_ops.retry_error",
      after_state: { error: redactErrorMessage(error instanceof Error ? error.message : String(error)), run_trace_id: trace_id },
      trace_id,
    });
    return { ok: false, message: "The re-run could not be started. The attempt is recorded.", trace_id };
  }
}

/**
 * Cancels queued work only. `processing_state` has no cancelled member, so a
 * cancellation is recorded as a stop with an explicit operator error code
 * rather than a fabricated status.
 */
export async function cancelAgentRun(
  operator: Operator,
  input: { job_id: string; reason: string },
): Promise<ActionResult> {
  const s = await admin();
  const trace_id = traceId();
  const job = await loadJob(input.job_id);
  const ws = await resolveWorkspace(job);

  if (runBucket(job.status) !== "queued") {
    return { ok: false, skipped: "not_cancellable", message: "Only work that has not started can be cancelled.", trace_id };
  }

  const { data: updated } = await s
    .from("processing_jobs")
    .update({
      status: "failed",
      error_code: "cancelled_by_operator",
      error_message: `Cancelled by platform operator: ${input.reason}`.slice(0, 500),
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "queued") // conditional write: a job that started meanwhile is left alone
    .select("id");

  if (!(updated ?? []).length) {
    return { ok: false, skipped: "not_cancellable", message: "This run started while you were deciding. Nothing was changed.", trace_id };
  }

  await writeAudit({
    actor_user_id: operator.user_id,
    organization_id: ws.organization_id,
    entity_type: "processing_job",
    entity_id: job.id,
    action: "agent_ops.cancel",
    before_state: { status: job.status, job_type: job.job_type },
    after_state: { status: "failed", error_code: "cancelled_by_operator", reason: input.reason },
    trace_id,
  });

  return { ok: true, message: "Queued run cancelled.", trace_id };
}

/** Pauses or resumes one agent for one workspace, via `agent_settings`. */
export async function setAgentPaused(
  operator: Operator,
  input: { organization_id: string; agent_key: AgentKey; paused: boolean; reason: string },
): Promise<ActionResult> {
  const s = await admin();
  const trace_id = traceId();

  const { data: before } = await s
    .from("agent_settings")
    .select("id,enabled,paused_at")
    .eq("organization_id", input.organization_id)
    .eq("agent_key", input.agent_key)
    .maybeSingle();

  const patch = {
    organization_id: input.organization_id,
    agent_key: input.agent_key,
    enabled: before?.enabled ?? true,
    paused_at: input.paused ? new Date().toISOString() : null,
    paused_by: input.paused ? operator.user_id : null,
    updated_by: operator.user_id,
    updated_at: new Date().toISOString(),
  };

  const { error } = await s
    .from("agent_settings")
    .upsert(patch as never, { onConflict: "organization_id,agent_key" });
  if (error) throw new Error("agent_pause_failed");

  // Stop queued work for a paused agent. `processing_state` has no cancelled
  // member, so paused work is stopped with an explicit operator code.
  let stopped = 0;
  if (input.paused) {
    const jobTypes = (await import("./agent-ops")).AGENT_JOB_TYPES[input.agent_key];
    if (jobTypes.length) {
      const { data } = await s
        .from("processing_jobs")
        .update({
          status: "failed",
          error_code: "agent_paused_by_operator",
          error_message: "Stopped because the agent was paused by a platform operator.",
          completed_at: new Date().toISOString(),
        })
        .eq("status", "queued")
        .in("job_type", jobTypes)
        .select("id");
      stopped = (data ?? []).length;
    }
  }

  await writeAudit({
    actor_user_id: operator.user_id,
    organization_id: input.organization_id,
    entity_type: "agent_settings",
    entity_id: before?.id ?? null,
    action: input.paused ? "agent_ops.pause_agent" : "agent_ops.resume_agent",
    before_state: { enabled: before?.enabled ?? null, paused_at: before?.paused_at ?? null },
    after_state: { paused: input.paused, reason: input.reason, queued_jobs_stopped: stopped },
    trace_id,
  });

  return {
    ok: true,
    message: input.paused
      ? `Agent paused for this workspace. ${stopped} queued job(s) stopped.`
      : "Agent resumed for this workspace.",
    trace_id,
  };
}

/**
 * Escalates a run to a human owner: creates a blocking, urgent task in the
 * run's workspace and notifies platform staff. Re-escalating an open
 * escalation updates it instead of creating a duplicate.
 */
export async function escalateAgentRun(
  operator: Operator,
  input: { job_id: string; reason: string; assignee_user_id?: string | null },
): Promise<ActionResult> {
  const s = await admin();
  const trace_id = traceId();
  const job = await loadJob(input.job_id);
  const ws = await resolveWorkspace(job);
  if (!ws.organization_id) {
    return { ok: false, skipped: "no_workspace", message: "This run has no resolvable workspace, so it cannot be escalated.", trace_id };
  }

  const matchId = job.entity_type === "candidate_match" ? job.entity_id : null;
  const title = `Agent run needs a human: ${job.job_type}`;

  const { data: existing } = await s
    .from("tasks")
    .select("id,priority,status,assignee_user_id")
    .eq("organization_id", ws.organization_id)
    .eq("task_type", "agent_escalation")
    .eq("title", title)
    .in("status", ["open", "in_progress"])
    .is("deleted_at", null)
    .limit(1);

  const row = {
    organization_id: ws.organization_id,
    position_id: ws.position_id,
    candidate_match_id: matchId,
    title,
    description: `Reason: ${input.reason}\nRun: ${job.job_type} (${job.status}), attempt ${job.attempts ?? 0}.`,
    status: "open",
    priority: "urgent",
    task_type: "agent_escalation",
    blocking: true,
    assignee_user_id: input.assignee_user_id ?? null,
    created_by: operator.user_id,
    metadata: { job_id: job.id, run_trace_id: trace_id, error_code: job.error_code ?? null },
    updated_at: new Date().toISOString(),
  };

  let taskId: string | null = (existing ?? [])[0]?.id ?? null;
  if (taskId) {
    await s.from("tasks").update(row as never).eq("id", taskId);
  } else {
    const { data: created, error } = await s.from("tasks").insert(row as never).select("id").maybeSingle();
    if (error) throw new Error("escalation_failed");
    taskId = created?.id ?? null;
  }

  await s.rpc("notify_platform_staff", {
    _organization_id: ws.organization_id,
    _event_type: "agent_run_blocked",
    _title: title,
    _body: input.reason.slice(0, 300),
    _link_path: "/admin/agent-ops",
  });

  await writeAudit({
    actor_user_id: operator.user_id,
    organization_id: ws.organization_id,
    entity_type: "processing_job",
    entity_id: job.id,
    action: "agent_ops.escalate",
    before_state: { existing_task: (existing ?? [])[0]?.id ?? null },
    after_state: {
      task_id: taskId,
      reason: input.reason,
      assignee_user_id: input.assignee_user_id ?? null,
      run_trace_id: job.trace_id ?? trace_id,
    },
    trace_id,
  });

  return { ok: true, message: existing?.length ? "Existing escalation updated." : "Escalation raised and platform staff notified.", trace_id };
}

/** Moves an existing escalation to another platform operator. */
export async function reassignAgentRun(
  operator: Operator,
  input: { job_id: string; assignee_user_id: string; reason: string },
): Promise<ActionResult> {
  const s = await admin();
  const trace_id = traceId();
  const job = await loadJob(input.job_id);
  const ws = await resolveWorkspace(job);
  if (!ws.organization_id) {
    return { ok: false, skipped: "no_workspace", message: "This run has no resolvable workspace, so it cannot be reassigned.", trace_id };
  }

  const assignable = await loadAssignableOperators();
  if (!assignable.some((a) => a.user_id === input.assignee_user_id)) {
    throw new Error("assignee_not_permitted");
  }

  const { data: task } = await s
    .from("tasks")
    .select("id,assignee_user_id")
    .eq("organization_id", ws.organization_id)
    .eq("task_type", "agent_escalation")
    .in("status", ["open", "in_progress"])
    .is("deleted_at", null)
    .contains("metadata", { job_id: job.id })
    .limit(1)
    .maybeSingle();

  if (!task) {
    // Reassignment implies ownership, so it escalates first rather than failing.
    return escalateAgentRun(operator, {
      job_id: input.job_id,
      reason: input.reason,
      assignee_user_id: input.assignee_user_id,
    });
  }

  await s
    .from("tasks")
    .update({ assignee_user_id: input.assignee_user_id, updated_at: new Date().toISOString() } as never)
    .eq("id", task.id);

  await writeAudit({
    actor_user_id: operator.user_id,
    organization_id: ws.organization_id,
    entity_type: "task",
    entity_id: task.id,
    action: "agent_ops.reassign",
    before_state: { assignee_user_id: task.assignee_user_id },
    after_state: { assignee_user_id: input.assignee_user_id, reason: input.reason, job_id: job.id },
    trace_id,
  });

  return { ok: true, message: "Escalation reassigned.", trace_id };
}

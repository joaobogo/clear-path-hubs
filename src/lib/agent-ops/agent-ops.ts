/**
 * Agent Operations Console — pure layer.
 *
 * Internal operator surface. Rules held here so the UI cannot break them:
 *  1. Every run shown corresponds to a `processing_jobs` row that already
 *     exists. Nothing in this file invents a run, a status or a result.
 *  2. An action is only ever offered when a real server function can carry it
 *     out for that run. `ACTION_BACKING` documents which one.
 *  3. Nothing operator-facing may carry secrets, credentials, hidden prompts,
 *     model reasoning or candidate personal data. `redactStructured` is the
 *     single gate; the server passes every free-form payload through it.
 */

import type { AgentKey } from "@/lib/agents/registry";

/**
 * Which agent owns which job type. Mirrors the switch-off mapping in
 * `agents.functions.ts` — an operator must see the same ownership the
 * workspace switch acts on.
 */
export const AGENT_JOB_TYPES: Record<AgentKey, string[]> = {
  sourcing: ["sourcing_scan", "longlist_build"],
  screening: [
    "cv_extract",
    "cv_parse",
    "parse",
    "cv_hydration",
    "hydration",
    "enrichment",
    "cv_enrich",
    "scoring",
    "score",
    "rescore",
    "evidence_extract",
  ],
  outreach: ["outreach_send", "outreach_sequence", "message_send"],
  scheduling: ["scheduling_offer", "interview_reminder"],
  market_research: ["market_refresh", "role_realism", "blueprint"],
  pipeline_watch: ["pipeline_scan", "sla_check", "notification"],
};

export function agentForJobType(jobType: string | null | undefined): AgentKey | null {
  const jt = String(jobType ?? "").toLowerCase();
  if (!jt) return null;
  for (const [key, types] of Object.entries(AGENT_JOB_TYPES)) {
    if (types.some((t) => jt === t || jt.includes(t))) return key as AgentKey;
  }
  return null;
}

// ---------------------------------------------------------------- buckets

export const RUN_BUCKETS = [
  "active",
  "queued",
  "waiting_approval",
  "failed",
  "completed",
  "superseded",
] as const;
export type RunBucket = (typeof RUN_BUCKETS)[number];

export const BUCKET_LABELS: Record<RunBucket, string> = {
  active: "Active runs",
  queued: "Queued work",
  waiting_approval: "Waiting approval",
  failed: "Failed runs",
  completed: "Completed runs",
  superseded: "Superseded / cancelled",
};

/**
 * Statuses that reach this layer come from two vocabularies: the
 * `processing_jobs.status` enum (`queued`, `running`, `completed`, `failed`,
 * `cancelled`, `superseded`) and the candidate `processing_state` values
 * (`parsing`, `scored`, `ocr_required`, …). Both are mapped here so counts,
 * lists and per-agent rollups can never disagree about the same row.
 */
const ACTIVE_STATES = [
  "parsing",
  "enriching",
  "scoring",
  "running",
  "processing",
  "in_progress",
  "started",
];
const COMPLETED_STATES = [
  "parsed",
  "ready_to_score",
  "scored",
  "completed",
  "complete",
  "done",
  "succeeded",
];
const APPROVAL_STATES = ["manual_review_required", "ocr_required"];
const FAILED_STATES = ["failed", "provider_blocked", "error"];
/** Terminal states where the run was replaced or deliberately stopped. */
const SUPERSEDED_STATES = ["superseded", "cancelled", "canceled", "obsolete", "skipped", "aborted", "replaced"];
const QUEUED_STATES = ["queued", "pending", "waiting", "scheduled"];

export function runBucket(status: string | null | undefined): RunBucket {
  const s = String(status ?? "").toLowerCase();
  if (FAILED_STATES.includes(s)) return "failed";
  if (SUPERSEDED_STATES.includes(s)) return "superseded";
  if (APPROVAL_STATES.includes(s)) return "waiting_approval";
  if (ACTIVE_STATES.includes(s)) return "active";
  if (COMPLETED_STATES.includes(s)) return "completed";
  if (QUEUED_STATES.includes(s)) return "queued";
  // Unknown vocabulary: never claim it is pending work.
  return "superseded";
}

/**
 * True when a run's stored error is only a "something newer already exists"
 * collision. These are not operational failures and must never surface as one.
 */
export function isSupersededError(
  errorCode: string | null | undefined,
  errorMessage: string | null | undefined,
): boolean {
  const code = String(errorCode ?? "").toLowerCase();
  const msg = String(errorMessage ?? "").toLowerCase();
  if (code.includes("supersed")) return true;
  return (
    msg.includes("supersed") ||
    msg.includes("already existed") ||
    msg.includes("score_runs_active_input_key") ||
    (msg.includes("duplicate key") && msg.includes("unique constraint"))
  );
}


/**
 * A run that claims to be in flight but has not moved for this long is
 * reported as stalled. Stalled is a display fact, never a status rewrite.
 */
export const STALL_THRESHOLD_MS = 15 * 60_000;

export function isStalled(
  bucket: RunBucket,
  startedAt: string | null,
  now = Date.now(),
): boolean {
  if (bucket !== "active") return false;
  if (!startedAt) return false;
  return now - new Date(startedAt).getTime() > STALL_THRESHOLD_MS;
}

// ------------------------------------------------------- error categories

export type ErrorCategory = {
  key: string;
  label: string;
  /** Whether re-running the same input can plausibly succeed. */
  retryable: boolean;
  /** What an operator should do first. */
  operator_hint: string;
};

const CATEGORIES: ErrorCategory[] = [
  {
    key: "input_unreadable",
    label: "Input unreadable",
    retryable: false,
    operator_hint: "The document cannot be read. Replace the file or send it to manual review.",
  },
  {
    key: "input_missing",
    label: "Input missing",
    retryable: false,
    operator_hint: "A required input is absent. Collect it before re-running.",
  },
  {
    key: "configuration",
    label: "Configuration",
    retryable: false,
    operator_hint: "The role or rubric is incomplete. Fix the configuration, then re-run.",
  },
  {
    key: "provider",
    label: "Provider",
    retryable: true,
    operator_hint: "An external provider failed or throttled. Re-running is usually safe.",
  },
  {
    key: "engine",
    label: "Engine",
    retryable: true,
    operator_hint: "The pipeline itself failed. Re-run once; escalate if it repeats.",
  },
  {
    key: "cancelled",
    label: "Cancelled by operator",
    retryable: true,
    operator_hint: "Stopped deliberately. Re-run only if the stop no longer applies.",
  },
  {
    key: "uncategorised",
    label: "Uncategorised",
    retryable: true,
    operator_hint: "No category matched. Inspect the audit trail before re-running.",
  },
];

export const ERROR_CATEGORIES = CATEGORIES;

export function categoriseError(
  errorCode: string | null | undefined,
  status?: string | null,
): ErrorCategory | null {
  const code = String(errorCode ?? "").toLowerCase();
  if (!code) {
    if (String(status ?? "").toLowerCase() === "provider_blocked") return CATEGORIES[3]!;
    return null;
  }
  if (code.includes("cancel")) return CATEGORIES[5]!;
  if (code.includes("unreadable") || code.includes("ocr")) return CATEGORIES[0]!;
  if (code.includes("missing")) return CATEGORIES[1]!;
  if (code.includes("requirements") || code.includes("inactive") || code.includes("config"))
    return CATEGORIES[2]!;
  if (code.includes("provider") || code.includes("rate_limit") || code.includes("timeout"))
    return CATEGORIES[3]!;
  if (code.includes("engine") || code.includes("internal")) return CATEGORIES[4]!;
  return CATEGORIES[6]!;
}

// ------------------------------------------------------------- escalation

export type EscalationState = "none" | "needs_human" | "escalated";

export function escalationState(input: {
  bucket: RunBucket;
  attempts: number;
  escalated: boolean;
}): EscalationState {
  if (input.escalated) return "escalated";
  if (input.bucket === "waiting_approval") return "needs_human";
  if (input.bucket === "failed" && input.attempts >= 2) return "needs_human";
  return "none";
}

// ---------------------------------------------------------------- actions

export const RUN_ACTIONS = [
  "retry",
  "cancel",
  "pause_agent",
  "resume_agent",
  "escalate",
  "reassign",
  "inspect_role",
  "inspect_audit",
] as const;
export type RunActionKey = (typeof RUN_ACTIONS)[number];

/**
 * The server function that actually performs each action. If an action is not
 * in this map it must not appear in the console.
 */
export const ACTION_BACKING: Record<RunActionKey, string> = {
  retry: "agent-ops.functions.ts → retryAgentRun (pipeline-runner.server)",
  cancel: "agent-ops.functions.ts → cancelAgentRun (processing_jobs)",
  pause_agent: "agent-ops.functions.ts → setAgentPaused (agent_settings)",
  resume_agent: "agent-ops.functions.ts → setAgentPaused (agent_settings)",
  escalate: "agent-ops.functions.ts → escalateAgentRun (tasks + notify_platform_staff)",
  reassign: "agent-ops.functions.ts → reassignAgentRun (tasks.assignee_user_id)",
  inspect_role: "route /admin/positions/$id",
  inspect_audit: "agent-ops.functions.ts → getAgentRunDetail (audit_events)",
};

/** Actions that change state and therefore require an explicit confirmation. */
export const CONSEQUENTIAL_ACTIONS: RunActionKey[] = [
  "retry",
  "cancel",
  "pause_agent",
  "resume_agent",
  "escalate",
  "reassign",
];

export type RunActionCapability = {
  /** Retry is only offered when a pipeline entry point exists for the job. */
  retryable: boolean;
  /** Only work that has not started can be cancelled. */
  cancellable: boolean;
  /** Pause/resume needs a resolved workspace and a known agent. */
  agent_switchable: boolean;
  /** Escalation and reassignment need a resolved workspace. */
  escalatable: boolean;
};

/** Job types the pipeline can actually re-run for a candidate match. */
const RETRYABLE_ENTITY = "candidate_match";

export function capabilitiesFor(run: {
  bucket: RunBucket;
  entity_type: string | null;
  job_type: string | null;
  organization_id: string | null;
  agent_key: AgentKey | null;
}): RunActionCapability {
  const isMatch = run.entity_type === RETRYABLE_ENTITY;
  const terminal = run.bucket === "failed" || run.bucket === "waiting_approval";
  return {
    retryable: isMatch && terminal,
    cancellable: run.bucket === "queued",
    agent_switchable: Boolean(run.organization_id && run.agent_key),
    escalatable: Boolean(run.organization_id),
  };
}

export function actionsFor(run: Parameters<typeof capabilitiesFor>[0] & {
  position_id: string | null;
  agent_paused: boolean;
}): RunActionKey[] {
  const cap = capabilitiesFor(run);
  const out: RunActionKey[] = [];
  if (cap.retryable) out.push("retry");
  if (cap.cancellable) out.push("cancel");
  if (cap.agent_switchable) out.push(run.agent_paused ? "resume_agent" : "pause_agent");
  if (cap.escalatable) out.push("escalate", "reassign");
  if (run.position_id) out.push("inspect_role");
  out.push("inspect_audit");
  return out;
}

// --------------------------------------------------------------- redaction

/**
 * Keys whose values never leave the server, whatever the shape of the record.
 * Matching is substring-based and case-insensitive so `openai_api_key`,
 * `systemPrompt` and `chain_of_thought` are all caught.
 */
const FORBIDDEN_KEY_FRAGMENTS = [
  "secret",
  "token",
  "api_key",
  "apikey",
  "password",
  "credential",
  "authorization",
  "bearer",
  "prompt",
  "system_message",
  "chain_of_thought",
  "reasoning",
  "thought",
  "raw_response",
  "email",
  "phone",
  "address",
  "date_of_birth",
  "dob",
  "national_id",
  "cv_text",
  "extracted_text",
  "resume_text",
];

const REDACTED = "[withheld]";
const MAX_DEPTH = 4;
const MAX_STRING = 400;

export function isForbiddenKey(key: string): boolean {
  const k = key.toLowerCase();
  return FORBIDDEN_KEY_FRAGMENTS.some((f) => k.includes(f));
}

/**
 * Structured inputs and outputs are shown to operators, so they pass through
 * here first: forbidden keys are replaced, long free text is truncated, and
 * depth is bounded so a nested provider payload cannot smuggle anything out.
 */
export function redactStructured(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= MAX_DEPTH) return REDACTED;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v) => redactStructured(v, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isForbiddenKey(k) ? REDACTED : redactStructured(v, depth + 1);
    }
    return out;
  }
  return REDACTED;
}

/**
 * Error messages come from providers and parsers, so they can contain URLs,
 * tokens and file paths. Operators need the shape of the failure, not the
 * payload.
 */
export function redactErrorMessage(message: string | null | undefined): string | null {
  if (!message) return null;
  return message
    .replace(/https?:\/\/\S+/g, "[url]")
    .replace(/(?:eyJ|sk-|sb_|Bearer\s+)[A-Za-z0-9._-]{8,}/g, REDACTED)
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .slice(0, 300);
}

// ------------------------------------------------------------------- cost

export function formatUsdMicros(micros: number | null | undefined): string | null {
  if (micros === null || micros === undefined) return null;
  const usd = micros / 1_000_000;
  if (usd === 0) return "$0.00";
  return usd < 0.01 ? "<$0.01" : `$${usd.toFixed(2)}`;
}

export function durationLabel(
  startedAt: string | null,
  completedAt: string | null,
  now = Date.now(),
): string | null {
  if (!startedAt) return null;
  const end = completedAt ? new Date(completedAt).getTime() : now;
  const ms = end - new Date(startedAt).getTime();
  if (ms < 0) return null;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// ------------------------------------------------------ shared row shapes

export type AgentRunRow = {
  id: string;
  job_type: string;
  agent_key: AgentKey | null;
  agent_name: string;
  status: string;
  bucket: RunBucket;
  stalled: boolean;
  attempts: number;
  entity_type: string | null;
  entity_id: string | null;
  organization_id: string | null;
  organization_name: string | null;
  /** The operator's own role over this workspace, resolved server-side. */
  viewer_scope: "platform_admin" | "platform_staff";
  position_id: string | null;
  position_title: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  duration_label: string | null;
  error_code: string | null;
  error_category: ErrorCategory | null;
  error_message: string | null;
  escalation: EscalationState;
  agent_paused: boolean;
  trace_id: string | null;
  usage: {
    calls: number;
    tokens_in: number;
    tokens_out: number;
    cost_label: string | null;
    latency_ms: number | null;
  } | null;
  actions: RunActionKey[];
};

/** Status of one agent inside the reported window. `idle` is a status too. */
export type AgentWindowStatus = "running" | "queued" | "failing" | "paused" | "idle";

export const AGENT_WINDOW_STATUS_LABELS: Record<AgentWindowStatus, string> = {
  running: "Running",
  queued: "Queued",
  failing: "Failing",
  paused: "Paused",
  idle: "Idle",
};

export type AgentOpsConsole = {
  generated_at: string;
  counts: Record<RunBucket, number>;
  runs: AgentRunRow[];
  agents: Array<{
    key: AgentKey;
    name: string;
    workspaces_paused: number;
    active: number;
    queued: number;
    runs: number;
    failed_24h: number;
    status: AgentWindowStatus;
  }>;

  window_hours: number;
};

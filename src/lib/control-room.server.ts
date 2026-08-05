/**
 * Server-only helpers behind the Control Room server functions.
 * Kept out of *.functions.ts so the server-fn split never loses them.
 */
import { jobLabel } from "@/lib/control-room-shared";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type RunningJob = { label: string; count: number };

export type SystemStatus = {
  running: RunningJob[];
  running_total: number;
  queued_total: number;
  retrying_total: number;
  failed_total: number;
  failed_examples: { label: string; message: string; at: string }[];
  last_completed_at: string | null;
  integrations: {
    key: string;
    name: string;
    state: string;
    last_success_at: string | null;
    last_error: string | null;
  }[];
  agents: { on: number; paused: number; off: number; total: number };
  checked_at: string;
  /** False when this seat/workspace cannot read status. Never an error. */
  can_read: boolean;
  /** Plain-language reason when `can_read` is false. */
  unavailable_reason: string | null;
};

/** A readable, non-error status shape for when we simply cannot read status. */
export function emptySystemStatus(
  totalAgents: number,
  reason: string,
): SystemStatus {
  return {
    running: [],
    running_total: 0,
    queued_total: 0,
    retrying_total: 0,
    failed_total: 0,
    failed_examples: [],
    last_completed_at: null,
    integrations: [],
    agents: { on: 0, paused: 0, off: totalAgents, total: totalAgents },
    checked_at: new Date().toISOString(),
    can_read: false,
    unavailable_reason: reason,
  };
}

const MAX_IDS = 4000;

export async function loadOrgEntityIds(
  supabase: Db,
  org: string,
): Promise<string[]> {
  const [positions, matches, applications] = await Promise.all([
    supabase.from("positions").select("id").eq("organization_id", org).limit(500),
    supabase
      .from("candidate_matches")
      .select("id")
      .eq("organization_id", org)
      .limit(2000),
    supabase
      .from("applications")
      .select("id")
      .eq("organization_id", org)
      .order("created_at", { ascending: false })
      .limit(1500),
  ]);

  const ids = [
    ...(positions.data ?? []).map((r: Db) => r.id),
    ...(matches.data ?? []).map((r: Db) => r.id),
    ...(applications.data ?? []).map((r: Db) => r.id),
  ];
  return ids.slice(0, MAX_IDS);
}

export async function buildSystemStatus(
  supabase: Db,
  org: string,
  totalAgents: number,
): Promise<SystemStatus> {
  const ids = await loadOrgEntityIds(supabase, org);
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();

  let jobs: Db[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200);
    try {
      const { data } = await supabase
        .from("processing_jobs")
        .select("job_type, status, attempts, error_message, created_at, completed_at")
        .in("entity_id", batch)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (data) jobs = jobs.concat(data);
    } catch {
      // Job visibility is staff-scoped on some seats; never fail the strip.
    }
  }

  const runningCounts = new Map<string, number>();
  for (const j of jobs.filter((j) => j.status === "running")) {
    const label = jobLabel(j.job_type);
    runningCounts.set(label, (runningCounts.get(label) ?? 0) + 1);
  }

  const failed = jobs.filter((j) => j.status === "failed");
  const retrying = failed.filter((j) => (j.attempts ?? 0) < 3);
  const stopped = failed.filter((j) => (j.attempts ?? 0) >= 3);

  const completed = jobs
    .filter((j) => j.status === "completed" && j.completed_at)
    .map((j) => j.completed_at as string)
    .sort();

  const { data: integrations } = await supabase
    .from("integration_sync_status")
    .select("integration_key, display_name, state, last_success_at, last_error")
    .eq("organization_id", org)
    .order("display_name");

  const { data: agentRows } = await supabase
    .from("agent_settings")
    .select("agent_key, enabled, paused_at")
    .eq("organization_id", org);

  const on = (agentRows ?? []).filter(
    (a: Db) => a.enabled && !a.paused_at,
  ).length;
  const paused = (agentRows ?? []).filter((a: Db) => !!a.paused_at).length;

  return {
    running: [...runningCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    running_total: jobs.filter((j) => j.status === "running").length,
    queued_total: jobs.filter((j) => j.status === "queued").length,
    retrying_total: retrying.length,
    failed_total: stopped.length,
    failed_examples: stopped.slice(0, 3).map((j) => ({
      label: jobLabel(j.job_type),
      message: j.error_message ?? "No reason recorded.",
      at: j.created_at,
    })),
    last_completed_at: completed.length ? completed[completed.length - 1] : null,
    integrations: (integrations ?? []).map((i: Db) => ({
      key: i.integration_key,
      name: i.display_name,
      state: i.state,
      last_success_at: i.last_success_at,
      last_error: i.last_error,
    })),
    agents: {
      on,
      paused,
      off: Math.max(0, totalAgents - on - paused),
      total: totalAgents,
    },
    checked_at: new Date().toISOString(),
    can_read: true,
    unavailable_reason: null,
  };
}

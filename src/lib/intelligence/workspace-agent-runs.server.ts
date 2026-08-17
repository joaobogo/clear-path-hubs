import { agentName } from "@/lib/agents/registry";
import { agentForJobType, runBucket } from "@/lib/agent-ops/agent-ops";


/**
 * Agent runs for one workspace, read from the same table the internal
 * agent-operations console reads (`processing_jobs`) and bucketed by the same
 * shared rule. This is what keeps the client-facing "agent runs" number equal
 * to the admin number for the same organisation and window.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export type WorkspaceAgentRun = {
  id: string;
  agent_key: string | null;
  agent_name: string | null;
  outcome: string;
  position_id: string | null;
  occurred_at: string;
  sentence: string | null;
  link_path: string | null;
};

export async function loadWorkspaceAgentRuns(input: {
  organizationId: string;
  positionId: string | null;
  sinceISO: string;
}): Promise<WorkspaceAgentRun[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let matchQ = supabaseAdmin
    .from("candidate_matches")
    .select("id, position_id")
    .eq("organization_id", input.organizationId);
  if (input.positionId) matchQ = matchQ.eq("position_id", input.positionId);
  const matches = ((await matchQ).data as Row[]) ?? [];

  let posQ = supabaseAdmin
    .from("positions")
    .select("id")
    .eq("organization_id", input.organizationId);
  if (input.positionId) posQ = posQ.eq("id", input.positionId);
  const positions = ((await posQ).data as Row[]) ?? [];

  const positionByMatch = new Map<string, string | null>(
    matches.map((m) => [m.id as string, (m.position_id as string) ?? null]),
  );
  const entityIds = [...positionByMatch.keys(), ...positions.map((p) => p.id as string)];
  if (!entityIds.length) return [];

  const { data } = await supabaseAdmin
    .from("processing_jobs")
    .select("id, entity_id, job_type, status, created_at, completed_at, attempts, error_code, error_message")
    .in("entity_id", entityIds)
    .gte("created_at", input.sinceISO)
    .order("created_at", { ascending: false })
    .limit(2000);

  return ((data as Row[]) ?? []).map((j) => {
    const key = agentForJobType(j.job_type) ?? null;
    const bucket = runBucket(j.status);
    return {
      id: j.id as string,
      agent_key: key,
      agent_name: key ? agentName(key) : null,
      outcome: bucket,
      position_id: positionByMatch.get(j.entity_id as string) ?? (j.entity_id as string) ?? null,
      occurred_at: (j.completed_at as string) ?? (j.created_at as string),
      sentence: null,
      link_path: null,
    };
  });
}

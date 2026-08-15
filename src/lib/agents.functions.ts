import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  AGENT_KEYS,
  AGENT_REGISTRY,
  agentName,
  type AgentKey,
} from "@/lib/agents/registry";
import { assertWorkspaceAccess } from "@/lib/authz/workspace-access";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const agentKey = z.enum(AGENT_KEYS as [string, ...string[]]);

async function assertMember(supabase: Db, userId: string, org: string) {
  await assertWorkspaceAccess(supabase, userId, org);
}

async function assertCanSwitch(supabase: Db, userId: string, org: string) {
  const { data: admin } = await supabase.rpc("is_org_admin", {
    _user: userId,
    _org: org,
  });
  if (admin) return;
  const { data: staff } = await supabase.rpc("is_platform_staff", {
    _user: userId,
  });
  if (!staff) {
    throw new Error(
      "Only a workspace admin can switch an agent on or off.",
    );
  }
}

/**
 * Work that must actually stop when an agent is switched off or paused.
 * Hiding the card is not stopping the work.
 */
const AGENT_JOB_TYPES: Record<AgentKey, string[]> = {
  sourcing: ["sourcing_scan", "longlist_build"],
  screening: ["cv_extract", "cv_hydration", "scoring", "evidence_extract"],
  outreach: ["outreach_send", "outreach_sequence"],
  scheduling: ["scheduling_offer", "interview_reminder"],
  market_research: ["market_refresh", "role_realism"],
  pipeline_watch: ["pipeline_scan", "sla_check"],
};

// Event types that Insights counts as "agent runs". Keep this in sync with
// src/lib/intelligence/hiring-intelligence.functions.ts.
const INSIGHTS_AGENT_RUN_TYPES = new Set([
  "candidate_stage_changed",
  "candidate_published",
  "message_sent",
  "clarification_requested",
  "contact_released",
  "interview_scheduled",
  "interview_completed",
]);

// Map business events from the activity feed (v_activity_feed) to the agent that
// owns them. This lets the agent control page show the same records as the
// Overview rail and Insights, even when the legacy agent_activity table is empty.
function eventTypeToAgentKey(eventType: string): AgentKey | null {
  switch (eventType) {
    case "candidate_stage_changed":
    case "client_shortlisted":
    case "client_approved":
    case "client_declined":
      return "pipeline_watch";
    case "candidate_published":
    case "contact_released":
      return "screening";
    case "message_sent":
    case "clarification_requested":
    case "application_received":
      return "outreach";
    case "interview_scheduled":
    case "interview_completed":
    case "interview_cancelled":
      return "scheduling";
    case "position_approved":
    case "position_published":
    case "blueprint_compiled":
      return "market_research";
    default:
      return null;
  }
}

function sentenceFromFeed(row: Db): string {
  const type = row.event_type as string;
  const title = (row.position_title as string | null) ?? "a role";
  const payload = (row.payload as Record<string, unknown> | null) ?? {};

  switch (type) {
    case "candidate_stage_changed":
      return `A candidate moved to ${payload.to ? `"${String(payload.to)}"` : "the next stage"} on ${title}.`;
    case "client_shortlisted":
      return `A candidate was shortlisted on ${title}.`;
    case "client_approved":
      return `A candidate was approved on ${title}.`;
    case "client_declined":
      return `A candidate was declined on ${title}.`;
    case "candidate_published":
      return `A candidate passed human review on ${title}.`;
    case "contact_released":
      return `Contact details were released for a candidate on ${title}.`;
    case "message_sent":
      return `A message was sent on ${title}.`;
    case "clarification_requested":
      return `A clarification was requested on ${title}.`;
    case "application_received":
      return `An application was received on ${title}.`;
    case "interview_scheduled":
      return `An interview was scheduled on ${title}.`;
    case "interview_completed":
      return `An interview was completed on ${title}.`;
    case "interview_cancelled":
      return `An interview was cancelled on ${title}.`;
    case "position_approved":
      return `${title} was approved and opened.`;
    case "position_published":
      return `${title} was published.`;
    case "blueprint_compiled":
      return `Blueprint compiled for ${title}.`;
    default:
      return `Activity recorded on ${title}.`;
  }
}

function linkPathFromFeed(row: Db): string | null {
  if (row.position_id) return `/client/positions/${row.position_id}`;
  if (row.candidate_match_id) return `/client/candidates/${row.candidate_match_id}`;
  if (row.application_id) return `/client/positions`; // no dedicated app page
  return null;
}



async function stopAgentWork(supabase: Db, org: string, key: AgentKey) {
  const stopped = { jobs: 0, touches: 0 };

  const jobTypes = AGENT_JOB_TYPES[key];
  if (jobTypes.length) {
    // `processing_state` has no `cancelled` member, so stopped work is
    // recorded as failed with an explicit code rather than an invalid status.
    const { data } = await supabase
      .from("processing_jobs")
      .update({
        status: "failed",
        error_code: "agent_switched_off",
        error_message: "Stopped because the agent was switched off for this workspace.",
        completed_at: new Date().toISOString(),
      })
      .eq("status", "queued")
      .in("job_type", jobTypes)
      .select("id");
    stopped.jobs = (data ?? []).length;
  }

  if (key === "outreach") {
    const { data } = await supabase
      .from("outreach_touches")
      .update({ state: "failed", blocked_reason: "agent_switched_off" })
      .eq("organization_id", org)
      .eq("state", "queued")
      .select("id");
    stopped.touches = (data ?? []).length;

    await supabase
      .from("outreach_campaigns")
      .update({ status: "paused" })
      .eq("organization_id", org)
      .eq("status", "active");
  }

  return stopped;
}

export type AgentCard = {
  key: AgentKey;
  name: string;
  job: string;
  inputs: string[];
  outputs: string[];
  never_without_human: string[];
  switch_permission: string;
  off_consequence: string;
  enabled: boolean;
  paused_at: string | null;
  state_line: string;
  last_action_at: string | null;
  last_action_summary: string | null;
  produced_this_week: number;
  blocked_this_week: number;
};

export type AgentPanel = {
  organization_id: string;
  can_manage: boolean;
  week_start: string;
  agents: AgentCard[];
};

export const getAgentPanel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organization_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<AgentPanel> => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    const org = data.organization_id;
    await assertMember(supabase, userId, org);

    const { data: isAdmin } = await supabase.rpc("is_org_admin", {
      _user: userId,
      _org: org,
    });
    const { data: isStaff } = await supabase.rpc("is_platform_staff", {
      _user: userId,
    });

    const weekStart = new Date();
    weekStart.setUTCDate(weekStart.getUTCDate() - 7);
    const since = weekStart.toISOString();

    const { data: settings } = await supabase
      .from("agent_settings")
      .select("agent_key, enabled, paused_at, last_action_at, last_action_summary")
      .eq("organization_id", org);

    // Read the same feed the Overview rail and Insights use. If the legacy
    // agent_activity table is empty, feed events still give us attributable runs.
    const { data: feed } = await supabase
      .from("v_activity_feed")
      .select(
        "event_id, event_type, occurred_at, position_id, position_title, candidate_match_id, application_id, payload",
      )
      .eq("organization_id", org)
      .gte("occurred_at", since)
      .limit(5000);

    const { data: activity } = await supabase
      .from("agent_activity")
      .select("id, agent_key, outcome, occurred_at, sentence")
      .eq("organization_id", org)
      .gte("occurred_at", since)
      .limit(5000);

    const byKey = new Map<string, Db>(
      (settings ?? []).map((s: Db) => [s.agent_key, s]),
    );

    const agents: AgentCard[] = AGENT_REGISTRY.map((def) => {
      const s = byKey.get(def.key);

      // Feed events attributable to this agent.
      const feedEvents = (feed ?? []).filter(
        (a: Db) => eventTypeToAgentKey(a.event_type as string) === def.key,
      );
      // Legacy agent_activity rows.
      const legacyEvents = (activity ?? []).filter(
        (a: Db) => a.agent_key === def.key,
      );

      const allEvents = [...feedEvents, ...legacyEvents]
        .sort(
          (a: Db, b: Db) =>
            (new Date(b.occurred_at).getTime() || 0) -
            (new Date(a.occurred_at).getTime() || 0),
        );
      const latest = allEvents[0];

      const latestFeed = feedEvents[0];
      const produced = feedEvents.filter((a: Db) =>
        INSIGHTS_AGENT_RUN_TYPES.has(a.event_type as string),
      ).length;
      const producedLegacy = legacyEvents.filter(
        (a: Db) => a.outcome === "acted",
      ).length;
      const blocked = legacyEvents.filter(
        (a: Db) => a.outcome === "blocked",
      ).length;

      const enabled = !!s?.enabled;
      const pausedAt = (s?.paused_at as string | null) ?? null;

      // Prefer the legacy explicit summary, then a generated sentence from the
      // feed, then a default "Nothing yet." (handled by the UI).
      const lastSummary =
        (s?.last_action_summary as string | null) ??
        (latestFeed ? sentenceFromFeed(latestFeed) : null) ??
        (latest ? latest.sentence : null) ??
        null;

      return {
        key: def.key,
        name: def.name,
        job: def.job,
        inputs: [...def.inputs],
        outputs: [...def.outputs],
        never_without_human: [...def.neverWithoutHuman],
        switch_permission: def.switchPermission,
        off_consequence: def.offConsequence,
        enabled,
        paused_at: pausedAt,
        state_line: pausedAt
          ? "Paused. It is not doing any work right now."
          : enabled
            ? "On and working."
            : `Off. ${def.offConsequence}`,
        last_action_at:
          (s?.last_action_at as string | null) ??
          latest?.occurred_at ??
          null,
        last_action_summary: lastSummary,
        produced_this_week: produced + producedLegacy,
        blocked_this_week: blocked,
      };
    });

    return {
      organization_id: org,
      can_manage: !!isAdmin || !!isStaff,
      week_start: since,
      agents,
    };
  });


export type SwitchResult = {
  agent_key: string;
  enabled: boolean;
  paused_at: string | null;
  stopped_jobs: number;
  stopped_messages: number;
};

export const setAgentEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        agent_key: agentKey,
        enabled: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<SwitchResult> => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    const org = data.organization_id;
    await assertCanSwitch(supabase, userId, org);

    const key = data.agent_key as AgentKey;
    let stopped = { jobs: 0, touches: 0 };
    if (!data.enabled) stopped = await stopAgentWork(supabase, org, key);

    const { error } = await supabase.from("agent_settings").upsert(
      {
        organization_id: org,
        agent_key: key,
        enabled: data.enabled,
        paused_at: null,
        paused_by: null,
        updated_by: userId,
      },
      { onConflict: "organization_id,agent_key" },
    );
    if (error) throw error;

    await supabase.from("agent_activity").insert({
      organization_id: org,
      agent_key: key,
      outcome: data.enabled ? "acted" : "skipped",
      sentence: data.enabled
        ? `${agentName(key)} was switched on.`
        : `${agentName(key)} was switched off and its queued work was stopped.`,
      reason: data.enabled ? null : "switched_off_by_admin",
    });

    return {
      agent_key: key,
      enabled: data.enabled,
      paused_at: null,
      stopped_jobs: stopped.jobs,
      stopped_messages: stopped.touches,
    };
  });

export const setAgentPaused = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        agent_key: agentKey,
        paused: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<SwitchResult> => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    const org = data.organization_id;
    await assertCanSwitch(supabase, userId, org);

    const key = data.agent_key as AgentKey;
    const pausedAt = data.paused ? new Date().toISOString() : null;
    let stopped = { jobs: 0, touches: 0 };
    if (data.paused) stopped = await stopAgentWork(supabase, org, key);

    const { error } = await supabase.from("agent_settings").upsert(
      {
        organization_id: org,
        agent_key: key,
        enabled: true,
        paused_at: pausedAt,
        paused_by: data.paused ? userId : null,
        updated_by: userId,
      },
      { onConflict: "organization_id,agent_key" },
    );
    if (error) throw error;

    await supabase.from("agent_activity").insert({
      organization_id: org,
      agent_key: key,
      outcome: data.paused ? "skipped" : "acted",
      sentence: data.paused
        ? `${agentName(key)} was paused. Work in the queue was stopped straight away.`
        : `${agentName(key)} was resumed.`,
      reason: data.paused ? "paused_by_admin" : null,
    });

    return {
      agent_key: key,
      enabled: true,
      paused_at: pausedAt,
      stopped_jobs: stopped.jobs,
      stopped_messages: stopped.touches,
    };
  });

export type ActivityRow = {
  id: string;
  agent_key: string;
  agent_name: string;
  outcome: "acted" | "blocked" | "skipped" | "failed";
  sentence: string;
  reason: string | null;
  link_path: string | null;
  occurred_at: string;
};

export const listAgentActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        agent_key: agentKey.optional(),
        limit: z.number().int().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<ActivityRow[]> => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    await assertMember(supabase, userId, data.organization_id);

    const limit = data.limit ?? 100;

    const [feedRes, legacyRes] = await Promise.all([
      supabase
        .from("v_activity_feed")
        .select(
          "event_id, event_type, occurred_at, position_id, position_title, candidate_match_id, application_id, payload",
        )
        .eq("organization_id", data.organization_id)
        .order("occurred_at", { ascending: false })
        .limit(limit),
      supabase
        .from("agent_activity")
        .select("id, agent_key, outcome, sentence, reason, link_path, occurred_at")
        .eq("organization_id", data.organization_id)
        .order("occurred_at", { ascending: false })
        .limit(limit),
    ]);

    const feedRows = (feedRes.data ?? []).filter((r: Db) => {
      const key = eventTypeToAgentKey(r.event_type as string);
      return data.agent_key ? key === data.agent_key : !!key;
    });

    const feedActivities: ActivityRow[] = feedRows.map((r: Db) => {
      const key = eventTypeToAgentKey(r.event_type as string)!;
      return {
        id: r.event_id,
        agent_key: key,
        agent_name: agentName(key),
        outcome: "acted",
        sentence: sentenceFromFeed(r),
        reason: null,
        link_path: linkPathFromFeed(r),
        occurred_at: r.occurred_at,
      };
    });

    const legacyActivities: ActivityRow[] = (legacyRes.data ?? [])
      .filter((r: Db) => (data.agent_key ? r.agent_key === data.agent_key : true))
      .map((r: Db) => ({
        id: r.id,
        agent_key: r.agent_key,
        agent_name: agentName(r.agent_key),
        outcome: r.outcome,
        sentence: r.sentence,
        reason: r.reason,
        link_path: r.link_path,
        occurred_at: r.occurred_at,
      }));

    return [...feedActivities, ...legacyActivities]
      .sort(
        (a, b) =>
          new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
      )
      .slice(0, limit);
  });


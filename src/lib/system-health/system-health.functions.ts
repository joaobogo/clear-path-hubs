/**
 * System health and freshness strip — reads.
 *
 * Everything here is read as the caller under RLS: no elevated client, no
 * cross-org reads, no platform-staff-only tables (`processing_jobs`,
 * `integration_health_checks`) for client seats. Raw error text, trace ids,
 * job ids, model names and engine versions are read only to decide a state and
 * are never returned.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  freshnessWord,
  hiddenSignal,
  hoursSince,
  newest,
  signal,
  summarise,
  unknownSignal,
  type HealthSignal,
  type SystemHealth,
} from "@/lib/system-health/system-health";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

const input = z.object({ organization_id: z.string().uuid() });

/** Beyond these ages a signal stops being able to claim it is current. */
const SYNC_DELAYED_HOURS = 24;
const DISCOVERY_DELAYED_HOURS = 72;
const SCORING_DELAYED_HOURS = 48;
const FRESHNESS_STALE_HOURS = 72;
const APPROVAL_NUDGE_HOURS = 72;

export const getSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => input.parse(raw))
  .handler(async ({ data, context }): Promise<SystemHealth> => {
    const supabase = context.supabase as Db;
    const userId = context.userId as string;
    const org = data.organization_id;
    const now = new Date();

    const [{ data: isMember }, { data: isAdmin }, { data: isStaff }] = await Promise.all([
      supabase.rpc("is_org_member", { _user: userId, _org: org }),
      supabase.rpc("is_org_admin", { _user: userId, _org: org }),
      supabase.rpc("is_platform_staff", { _user: userId }),
    ]);

    const canRead = !!isMember || !!isStaff;
    const canSeeAgents = !!isMember || !!isStaff;
    const canSeeIntegrations = !!isAdmin || !!isStaff;

    if (!canRead) {
      return {
        organization_id: org,
        signals: [],
        overall: "unavailable",
        headline: "System status isn't shown for this workspace on your seat.",
        attention_count: 0,
        fetched_at: now.toISOString(),
        can_read: false,
      };
    }

    const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();

    const [agentsRes, activityRes, syncRes, matchesRes, scoreRes, positionsRes] =
      await Promise.all([
        supabase
          .from("agent_settings")
          .select("agent_key, enabled, paused_at, last_action_at")
          .eq("organization_id", org),
        supabase
          .from("agent_activity")
          .select("agent_key, outcome, occurred_at")
          .eq("organization_id", org)
          .gte("occurred_at", since)
          .order("occurred_at", { ascending: false })
          .limit(400),
        canSeeIntegrations
          ? supabase
              .from("integration_sync_status")
              .select("integration_key, display_name, state, last_success_at, last_attempt_at")
              .eq("organization_id", org)
          : Promise.resolve({ data: null }),
        supabase
          .from("candidate_matches")
          .select("id, stage, client_visibility, delivered_at, recommendation, updated_at")
          .eq("organization_id", org)
          .order("updated_at", { ascending: false })
          .limit(400),
        supabase
          .from("score_runs")
          .select("completed_at, status")
          .eq("organization_id", org)
          .order("completed_at", { ascending: false })
          .limit(50),
        supabase
          .from("positions")
          .select("id, status, blueprint_status, blueprint_generated_at, updated_at")
          .eq("organization_id", org)
          .order("updated_at", { ascending: false })
          .limit(200),
      ]);

    const agents = (agentsRes.data as Row[]) ?? [];
    const activity = (activityRes.data as Row[]) ?? [];
    const syncRows = (syncRes as { data: Row[] | null }).data ?? null;
    const matches = (matchesRes.data as Row[]) ?? [];
    const scoreRuns = (scoreRes.data as Row[]) ?? [];
    const positions = (positionsRes.data as Row[]) ?? [];

    const signals: HealthSignal[] = [];

    // 1. Agent system status.
    if (!canSeeAgents) {
      signals.push(hiddenSignal("agents", "a workspace admin"));
    } else if (agents.length === 0 && activity.length === 0) {
      signals.push(
        unknownSignal(
          "agents",
          "No agent has run for this workspace yet, so there is nothing to report.",
        ),
      );
    } else {
      const paused = agents.filter((a) => !!a.paused_at || a.enabled === false);
      const lastAgentAt = newest(
        ...agents.map((a) => a.last_action_at as string | null),
        ...activity.slice(0, 1).map((a) => a.occurred_at as string),
      );
      const running = activity.some(
        (a) => (hoursSince(a.occurred_at as string, now) ?? 999) < 6 && a.outcome === "acted",
      );
      if (paused.length > 0 && paused.length === agents.length && agents.length > 0) {
        signals.push(
          signal("agents", {
            state: "degraded",
            evidence: "measured",
            detail: "Every agent is paused, so no new work is being picked up.",
            measured_at: lastAgentAt,
            count: paused.length,
            actions: ["open_agents"],
          }),
        );
      } else if (paused.length > 0) {
        signals.push(
          signal("agents", {
            state: "delayed",
            evidence: "measured",
            detail: `${paused.length} agent${paused.length === 1 ? " is" : "s are"} paused. The rest are working.`,
            measured_at: lastAgentAt,
            count: paused.length,
            actions: ["open_agents"],
          }),
        );
      } else if (running) {
        signals.push(
          signal("agents", {
            state: "processing",
            evidence: "measured",
            detail: "Agents are working now. Nothing is waiting on you.",
            measured_at: lastAgentAt,
            count: agents.length || null,
            actions: ["open_activity"],
          }),
        );
      } else if (lastAgentAt) {
        signals.push(
          signal("agents", {
            state: "operational",
            evidence: "measured",
            detail: `Agents are on. Last recorded action ${freshnessWord(hoursSince(lastAgentAt, now) ?? 0)}.`,
            measured_at: lastAgentAt,
            count: agents.length || null,
            actions: ["open_activity"],
          }),
        );
      } else {
        signals.push(
          unknownSignal("agents", "Agents are configured but have not recorded an action yet."),
        );
      }
    }

    // 2. Last successful synchronization (connected systems).
    if (!canSeeIntegrations) {
      signals.push(hiddenSignal("sync", "a workspace admin"));
    } else if (!syncRows || syncRows.length === 0) {
      signals.push(
        unknownSignal("sync", "No outside system is connected, so there is nothing to sync."),
      );
    } else {
      const lastSuccess = newest(...syncRows.map((r) => r.last_success_at as string | null));
      const hrs = hoursSince(lastSuccess, now);
      if (hrs === null) {
        signals.push(
          unknownSignal("sync", "A connection exists but has not completed a sync yet."),
        );
      } else if (hrs > SYNC_DELAYED_HOURS) {
        signals.push(
          signal("sync", {
            state: "delayed",
            evidence: "measured",
            detail: `The last successful sync was ${freshnessWord(hrs)}. Some records may be behind.`,
            measured_at: lastSuccess,
            count: null,
            actions: ["open_integrations"],
          }),
        );
      } else {
        signals.push(
          signal("sync", {
            state: "operational",
            evidence: "measured",
            detail: `Last successful sync ${freshnessWord(hrs)}.`,
            measured_at: lastSuccess,
            count: null,
            actions: ["open_integrations"],
          }),
        );
      }
    }

    // 3. Last sourcing or discovery run.
    const openRoles = positions.filter((p) => p.status === "open" || p.status === "published");
    const discoveryRuns = activity.filter(
      (a) => a.agent_key === "sourcing" || a.agent_key === "outreach",
    );
    const lastDiscovery = newest(
      ...discoveryRuns.map((a) => a.occurred_at as string),
      ...positions.map((p) => p.blueprint_generated_at as string | null),
    );
    if (!lastDiscovery) {
      signals.push(
        unknownSignal(
          "discovery",
          openRoles.length > 0
            ? "No discovery run is on record for this workspace yet."
            : "Discovery starts once a role is live.",
        ),
      );
    } else {
      const hrs = hoursSince(lastDiscovery, now) ?? 0;
      const stillRunning = discoveryRuns.some(
        (a) => (hoursSince(a.occurred_at as string, now) ?? 999) < 6,
      );
      if (stillRunning) {
        signals.push(
          signal("discovery", {
            state: "processing",
            evidence: "measured",
            detail: "Sourcing is running now.",
            measured_at: lastDiscovery,
            count: null,
            actions: ["open_activity"],
          }),
        );
      } else if (openRoles.length > 0 && hrs > DISCOVERY_DELAYED_HOURS) {
        signals.push(
          signal("discovery", {
            state: "delayed",
            evidence: "measured",
            detail: `No sourcing run in the last ${Math.round(hrs / 24)} days while roles are open.`,
            measured_at: lastDiscovery,
            count: openRoles.length,
            actions: ["open_roles", "open_activity"],
          }),
        );
      } else {
        signals.push(
          signal("discovery", {
            state: "operational",
            evidence: "measured",
            detail: `Last sourcing run ${freshnessWord(hrs)}.`,
            measured_at: lastDiscovery,
            count: null,
            actions: ["open_activity"],
          }),
        );
      }
    }

    // 4. Scoring freshness.
    const lastScored = newest(...scoreRuns.map((r) => r.completed_at as string | null));
    if (!lastScored) {
      signals.push(
        unknownSignal("scoring", "No candidate has been scored for this workspace yet."),
      );
    } else {
      const hrs = hoursSince(lastScored, now) ?? 0;
      const waitingOnScore = matches.filter(
        (m) => m.client_visibility !== "visible" && !m.delivered_at,
      ).length;
      if (hrs > SCORING_DELAYED_HOURS && waitingOnScore > 0) {
        signals.push(
          signal("scoring", {
            state: "delayed",
            evidence: "measured",
            detail: `Scoring last completed ${freshnessWord(hrs)} with candidates still in review.`,
            measured_at: lastScored,
            count: waitingOnScore,
            actions: ["open_activity"],
          }),
        );
      } else {
        signals.push(
          signal("scoring", {
            state: "operational",
            evidence: "measured",
            detail: `Scores are current as of ${freshnessWord(hrs)}.`,
            measured_at: lastScored,
            count: null,
            actions: ["open_approvals"],
          }),
        );
      }
    }

    // 5. Pending approvals — the one place the strip may ask for a person.
    const pending = matches.filter(
      (m) =>
        m.client_visibility === "visible" &&
        !!m.delivered_at &&
        (m.recommendation === null || m.recommendation === "pending"),
    );
    if (matches.length === 0) {
      signals.push(
        unknownSignal("approvals", "No candidates have reached this workspace yet."),
      );
    } else if (pending.length === 0) {
      signals.push(
        signal("approvals", {
          state: "operational",
          evidence: "measured",
          detail: "Nothing is waiting on a decision.",
          measured_at: now.toISOString(),
          count: 0,
          actions: ["open_approvals"],
        }),
      );
    } else {
      const oldest = pending
        .map((m) => m.delivered_at as string)
        .sort((a, b) => (a < b ? -1 : 1))[0]!;
      const waitedHrs = hoursSince(oldest, now) ?? 0;
      signals.push(
        signal("approvals", {
          state: waitedHrs > APPROVAL_NUDGE_HOURS ? "action_required" : "waiting_approval",
          evidence: "measured",
          detail:
            waitedHrs > APPROVAL_NUDGE_HOURS
              ? `${pending.length} candidate${pending.length === 1 ? "" : "s"} have been waiting on you since ${freshnessWord(waitedHrs)}.`
              : `${pending.length} candidate${pending.length === 1 ? "" : "s"} waiting for your decision.`,
          measured_at: oldest,
          count: pending.length,
          actions: ["open_approvals"],
        }),
      );
    }

    // 6. Integration health.
    if (!canSeeIntegrations) {
      signals.push(hiddenSignal("integrations", "a workspace admin"));
    } else if (!syncRows || syncRows.length === 0) {
      signals.push(
        unknownSignal("integrations", "Nothing is connected yet, so there is nothing to check."),
      );
    } else {
      // `state` is a short machine word from our own table, not a provider
      // message, so it is safe to count — but we never surface last_error.
      const failing = syncRows.filter((r) => r.state === "error" || r.state === "failed");
      const connecting = syncRows.filter((r) => r.state === "connecting" || r.state === "syncing");
      const lastAttempt = newest(...syncRows.map((r) => r.last_attempt_at as string | null));
      if (failing.length > 0) {
        const names = failing
          .map((r) => (r.display_name as string) || (r.integration_key as string))
          .slice(0, 2)
          .join(", ");
        signals.push(
          signal("integrations", {
            state: "degraded",
            evidence: "measured",
            detail: `${names} ${failing.length === 1 ? "is" : "are"} not connecting. Reconnecting fixes it.`,
            measured_at: lastAttempt,
            count: failing.length,
            actions: ["open_integrations"],
          }),
        );
      } else if (connecting.length > 0) {
        signals.push(
          signal("integrations", {
            state: "processing",
            evidence: "measured",
            detail: `${connecting.length} connection${connecting.length === 1 ? " is" : "s are"} still setting up.`,
            measured_at: lastAttempt,
            count: connecting.length,
            actions: ["open_integrations"],
          }),
        );
      } else {
        signals.push(
          signal("integrations", {
            state: "operational",
            evidence: "measured",
            detail: `${syncRows.length} connection${syncRows.length === 1 ? "" : "s"} healthy.`,
            measured_at: lastAttempt,
            count: syncRows.length,
            actions: ["open_integrations"],
          }),
        );
      }
    }

    // 7. Data freshness — how current the numbers on screen are.
    const lastAnything = newest(
      ...activity.slice(0, 1).map((a) => a.occurred_at as string),
      ...matches.slice(0, 1).map((m) => m.updated_at as string),
      ...positions.slice(0, 1).map((p) => p.updated_at as string),
      lastScored,
    );
    if (!lastAnything) {
      signals.push(
        unknownSignal("freshness", "There is no recorded activity to measure freshness against."),
      );
    } else {
      const hrs = hoursSince(lastAnything, now) ?? 0;
      signals.push(
        signal("freshness", {
          state: hrs > FRESHNESS_STALE_HOURS ? "delayed" : "operational",
          evidence: "measured",
          detail:
            hrs > FRESHNESS_STALE_HOURS
              ? `Nothing has changed here since ${freshnessWord(hrs)}. What you see is current, but quiet.`
              : `Everything on this page reflects activity up to ${freshnessWord(hrs)}.`,
          measured_at: lastAnything,
          count: null,
          actions: ["refresh"],
        }),
      );
    }

    // 8. Issues requiring attention — counted, never quoted.
    const failedBlueprints = positions.filter((p) => p.blueprint_status === "failed");
    const failedRuns = activity.filter((a) => a.outcome === "failed");
    const issueCount = failedBlueprints.length + failedRuns.length;
    if (activity.length === 0 && positions.length === 0) {
      signals.push(unknownSignal("issues", "Nothing has run yet, so there is nothing to check."));
    } else if (issueCount === 0) {
      signals.push(
        signal("issues", {
          state: "operational",
          evidence: "measured",
          detail: "No failed runs in the last 30 days.",
          measured_at: now.toISOString(),
          count: 0,
          actions: [],
        }),
      );
    } else {
      signals.push(
        signal("issues", {
          state: failedBlueprints.length > 0 ? "action_required" : "degraded",
          evidence: "measured",
          detail:
            failedBlueprints.length > 0
              ? `${failedBlueprints.length} role${failedBlueprints.length === 1 ? "" : "s"} could not finish setup. You can run it again.`
              : `${failedRuns.length} run${failedRuns.length === 1 ? "" : "s"} did not finish. Our team is notified.`,
          measured_at: newest(...failedRuns.slice(0, 1).map((a) => a.occurred_at as string)),
          count: issueCount,
          actions: failedBlueprints.length > 0 ? ["open_roles", "open_activity"] : ["open_activity"],
        }),
      );
    }

    return {
      organization_id: org,
      signals,
      can_read: true,
      ...summarise(signals, now),
    };
  });

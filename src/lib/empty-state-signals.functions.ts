/**
 * Empty-state signals.
 *
 * One RLS-scoped read that tells any surface *why* it is empty: is a role live,
 * has discovery started, is anything processing right now, did a run finish
 * without qualifiers, how much data exists for metrics. Every count comes from
 * real rows — we never assume work is happening.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface EmptyStateSignals {
  activeRoles: number;
  rolesInSetup: number;
  /** At least one sourcing/scoring run exists for this workspace. */
  discoveryStarted: boolean;
  /** Candidates currently in extraction/scoring — not yet reviewable. */
  inProcessing: number;
  /** Finished score runs (discovery produced results, qualifying or not). */
  runsCompleted: number;
  /** Runs queued or executing right now. */
  runsRunning: number;
  /** Candidates released to the client and awaiting a decision. */
  awaitingDecision: number;
  interviews: number;
  openOffers: number;
  hires: number;
  /** Rows available to compute analytics from. */
  observations: number;
  connectedIntegrations: number;
  auditEvents: number;
  notifications: number;
}

const EMPTY: EmptyStateSignals = {
  activeRoles: 0,
  rolesInSetup: 0,
  discoveryStarted: false,
  inProcessing: 0,
  runsCompleted: 0,
  runsRunning: 0,
  awaitingDecision: 0,
  interviews: 0,
  openOffers: 0,
  hires: 0,
  observations: 0,
  connectedIntegrations: 0,
  auditEvents: 0,
  notifications: 0,
};

async function countRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  builder: any,
): Promise<number> {
  const { count, error } = await builder;
  if (error) return 0;
  return count ?? 0;
}

export const getEmptyStateSignals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; positionId?: string }) =>
    z
      .object({ orgId: z.string().uuid(), positionId: z.string().uuid().optional() })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<EmptyStateSignals> => {
    const sb = context.supabase;
    const org = data.orgId;
    const head = { count: "exact" as const, head: true };

    const scopedMatches = () => {
      let q = sb.from("candidate_matches").select("id", head).eq("organization_id", org);
      if (data.positionId) q = q.eq("position_id", data.positionId);
      return q;
    };

    try {
      const [
        activeRoles,
        rolesInSetup,
        inProcessing,
        runsCompleted,
        runsRunning,
        awaitingDecision,
        delivered,
        interviews,
        openOffers,
        hires,
        connectedIntegrations,
        auditEvents,
        notifications,
      ] = await Promise.all([
        countRows(
          sb.from("positions").select("id", head).eq("organization_id", org).eq("status", "active"),
        ),
        countRows(
          sb.from("positions").select("id", head).eq("organization_id", org).eq("status", "draft"),
        ),
        countRows(scopedMatches().in("processing_state", ["queued", "parsing", "parsed", "enriching", "ready_to_score", "scoring"])),
        countRows(
          sb.from("score_runs").select("id", head).eq("organization_id", org).eq("status", "completed"),
        ),
        countRows(
          sb.from("score_runs").select("id", head).eq("organization_id", org).in("status", ["queued", "running"]),
        ),
        countRows(scopedMatches().eq("client_visibility", "visible").eq("stage", "delivered")),
        countRows(scopedMatches().not("delivered_at", "is", null)),
        countRows(sb.from("interviews").select("id", head).eq("organization_id", org)),
        countRows(
          sb
            .from("hire_records")
            .select("id", head)
            .eq("organization_id", org)
            .in("status", ["offer_drafted", "offer_sent", "offer_negotiating"]),
        ),
        countRows(
          sb.from("hire_records").select("id", head).eq("organization_id", org).eq("status", "hire_confirmed"),
        ),
        countRows(
          sb
            .from("integration_sync_status")
            .select("id", head)
            .eq("organization_id", org),
        ),
        countRows(sb.from("audit_events").select("id", head).eq("organization_id", org)),
        countRows(sb.from("notifications").select("id", head).eq("organization_id", org)),
      ]);

      return {
        activeRoles,
        rolesInSetup,
        discoveryStarted: runsCompleted + runsRunning > 0 || inProcessing > 0,
        inProcessing,
        runsCompleted,
        runsRunning,
        awaitingDecision,
        interviews,
        openOffers,
        hires,
        observations: delivered,
        connectedIntegrations,
        auditEvents,
        notifications,
      };
    } catch {
      return EMPTY;
    }
  });

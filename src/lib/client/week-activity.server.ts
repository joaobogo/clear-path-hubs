import { CLIENT_DECISION_ACTIONS } from "@/lib/client-activity-actions";
import { WEEKLY_WINDOW_DAYS } from "@/lib/client-weekly-update";

/**
 * Single source of truth for the "This week" interview and decision counts on
 * the client workspace.
 *
 * Interviews come from recorded completions (`interviews.completed_at`),
 * decisions from the same whitelisted `audit_events` rows the Recent activity
 * feed lists — so the tiles, the weekly card and the activity list cannot
 * disagree about the same window.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WeekActivityRow = Record<string, any>;

export interface ClientWeekActivity {
  /** Inclusive window start / end, ISO. */
  windowStart: string;
  windowEnd: string;
  /** Interviews actually held in the window (completed, not merely booked). */
  interviewsHeld: WeekActivityRow[];
  /** One row per recorded decision event, de-duplicated by event id. */
  decisions: WeekActivityRow[];
  interviewsHeldCount: number;
  decisionsCount: number;
}

export function clientWeekWindow(now: Date = new Date()): { startIso: string; endIso: string } {
  return {
    startIso: new Date(now.getTime() - WEEKLY_WINDOW_DAYS * 86_400_000).toISOString(),
    endIso: now.toISOString(),
  };
}

/**
 * @param client user-scoped (RLS) or admin Supabase client for `interviews`
 * @param orgId  organization the window is scoped to
 */
export async function loadClientWeekActivity(
  client: AnyClient,
  orgId: string,
  now: Date = new Date(),
): Promise<ClientWeekActivity> {
  const { startIso, endIso } = clientWeekWindow(now);

  // audit_events is staff-only under RLS, so decision events are read with the
  // admin client, still scoped to this organization.
  const { supabaseAdmin: auditDb } = await import("@/integrations/supabase/client.server");

  const [interviewsRes, decisionsRes] = await Promise.all([
    client
      .from("interviews")
      .select("id, position_id, candidate_match_id, completed_at, positions(title)")
      .eq("organization_id", orgId)
      .not("completed_at", "is", null)
      .gte("completed_at", startIso)
      .lte("completed_at", endIso)
      .order("completed_at", { ascending: true }),

    (auditDb as AnyClient)
      .from("audit_events")
      .select("id, action, entity_id, entity_type, created_at")
      .eq("organization_id", orgId)
      .in("action", [...CLIENT_DECISION_ACTIONS])
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: true }),
  ]);

  const interviewsHeld = (interviewsRes.data ?? []) as WeekActivityRow[];
  const decisions = ((decisionsRes.data ?? []) as WeekActivityRow[]).filter(
    (d, i, all) => all.findIndex((o) => o.id === d.id) === i,
  );

  return {
    windowStart: startIso,
    windowEnd: endIso,
    interviewsHeld,
    decisions,
    interviewsHeldCount: interviewsHeld.length,
    decisionsCount: decisions.length,
  };
}

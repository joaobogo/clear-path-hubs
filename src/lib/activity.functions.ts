// Canonical activity feed.
//
// There is exactly ONE persisted source of truth for "something happened":
// `notification_events`. Notifications (per-recipient inbox) and this activity
// feed are both *derived* from it — we never write a second copy of an event.
//
// Authorization is enforced twice, on purpose:
//   1. Row-level security on notification_events (organisation scope, candidate
//      visibility, contact release) decides which rows the caller can read.
//   2. `isVisibleActivity()` decides which event kinds that audience should see
//      at all, so internal operational noise never reaches clients.
//
// Nothing here fabricates activity: an empty feed renders as empty.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  ACTIVITY_LABELS,
  isVisibleActivity,
  type Audience,
  type EventType,
} from "@/lib/events";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export type ActivityEntry = {
  event_id: string;
  event_type: EventType;
  label: string;
  /** Always ISO-8601 UTC. Clients format in the viewer's timezone. */
  occurred_at: string;
  actor_name: string | null;
  position_title: string | null;
  position_status: string | null;
  organization_id: string | null;
  link_path: string | null;
  feedback?: string | null;
};

export type ActivityFeed = {
  audience: Audience;
  entries: ActivityEntry[];
  /** Server time of this read — used for a truthful "last updated" label. */
  fetched_at: string;
};

const input = z.object({
  organization_id: z.string().uuid().optional(),
  position_id: z.string().uuid().optional(),
  candidate_match_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

function linkFor(audience: Audience, row: AnyRow): string | null {
  if (audience === "candidate") {
    return row.application_id ? `/me/applications/${row.application_id}` : "/me";
  }
  const base = audience === "admin" ? "/admin" : "/client";
  if (row.candidate_match_id) return `${base}/candidates/${row.candidate_match_id}`;
  if (row.position_id) return `${base}/positions/${row.position_id}`;
  return null;
}

async function resolveAudience(supabase: AnyRow, userId: string): Promise<Audience> {
  const { data } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("status", "active");
  const roles = ((data as AnyRow[]) ?? []).map((r) => r.role as string);
  if (roles.some((r) => r === "platform_admin" || r === "operations")) return "admin";
  if (roles.some((r) => r.startsWith("client_"))) return "client";
  return "candidate";
}

export const getActivityFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => input.parse(i ?? {}))
  .handler(async ({ data, context }): Promise<ActivityFeed> => {
    const audience = await resolveAudience(context.supabase, context.userId);
    const limit = data.limit ?? 25;
    // Over-fetch a little because the editorial gate below can drop rows.
    const window = Math.min(limit * 3, 200);

    if (audience === "candidate") {
      // Candidates have no organisation scope; their timeline is their own
      // notification inbox, which is already recipient-scoped by RLS.
      const { data: rows, error } = await context.supabase
        .from("notifications")
        .select("id, event_type, created_at, link_path, organization_id")
        .eq("recipient_user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(window);
      if (error) throw new Error(error.message);
      const entries = ((rows as AnyRow[]) ?? [])
        .filter((r) => isVisibleActivity("candidate", r.event_type as EventType))
        .slice(0, limit)
        .map((r) => ({
          event_id: r.id as string,
          event_type: r.event_type as EventType,
          label: ACTIVITY_LABELS[r.event_type as EventType] ?? "Update",
          occurred_at: new Date(r.created_at as string).toISOString(),
          actor_name: null,
          position_title: null,
          position_status: null,
          organization_id: (r.organization_id as string) ?? null,
          link_path: (r.link_path as string) ?? null,
        }));
      return { audience, entries, fetched_at: new Date().toISOString() };
    }

    let q = context.supabase
      .from("v_activity_feed")
      .select(
        "event_id, event_type, occurred_at, organization_id, position_id, application_id, candidate_match_id, actor_name, position_title, position_status, payload, is_test_record",
      )
      .eq("is_test_record", false)
      .order("occurred_at", { ascending: false })
      .limit(window);

    if (data.organization_id) q = q.eq("organization_id", data.organization_id);
    if (data.position_id) q = q.eq("position_id", data.position_id);
    if (data.candidate_match_id) q = q.eq("candidate_match_id", data.candidate_match_id);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const entries = ((rows as AnyRow[]) ?? [])
      .filter((r) => isVisibleActivity(audience, r.event_type as EventType))
      .map((r) => {
        const label = ACTIVITY_LABELS[r.event_type as EventType] ?? "Update";
        let actorName = (r.actor_name as string) ?? null;

        // F-030: Humanize system/staff actors for clients
        if (audience === "client") {
          const low = (actorName || "").toLowerCase();
          if (!actorName || low.includes("master admin") || low.includes("system") || low === "taasflow") {
            actorName = "System";
          } else if (low === "your team" && r.event_type !== "client_decision.create") {
            actorName = "System";
          }
        }

        // Tidy up message events that lack a subject/actor
        if (r.event_type === "message_sent" && !actorName) {
          actorName = audience === "client" ? "TaaSFlow team" : "System";
        }

        // Ensure every event has an actor (fallback to System if still null)
        if (!actorName) {
          actorName = "System";
        }

        return {
          event_id: r.event_id as string,
          event_type: r.event_type as EventType,
          label,
          occurred_at: new Date(r.occurred_at as string).toISOString(),
          actor_name: actorName,
          position_title: (r.position_title as string) ?? null,
          position_status: (r.position_status as string) ?? null,
          organization_id: (r.organization_id as string) ?? null,
          link_path: linkFor(audience, r),
          feedback: (r.payload as Record<string, any>)?.feedback ?? null,
        };
      })
      .filter((e) => {
        // Exclude events that still have no context and would be redundant/confusing
        if (e.event_type === "message_sent" && e.actor_name === "System" && !e.position_title) return false;
        return true;
      })
      .slice(0, limit);

    return { audience, entries, fetched_at: new Date().toISOString() };
  });

/**
 * Agent Activity rail — reads.
 *
 * Every row here comes from a table the caller can already read under RLS, and
 * nothing is fetched with elevated privileges. The rail is a *view* of work,
 * so it must never be able to show more than the workspace is entitled to see:
 *
 *  - Candidate identity appears only for matches with client_visibility =
 *    'visible'. Everything else is reported as "a candidate" so the record of
 *    work stays honest without naming someone the client may not see yet.
 *  - Internal machinery stays server-side. Job ids, trace ids, model names,
 *    engine versions and raw error strings are read but never returned.
 *  - `processing_jobs` is deliberately NOT a source: it is platform-staff only
 *    and describes internal queues, not client-facing work.
 *  - Actions are attached per item and only when the caller's seat can actually
 *    perform them, which the underlying server functions re-check.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { agentName } from "@/lib/agents/registry";
import {
  collapseItems,
  groupItems,
  kindFromAgentKey,
  needsAttention,
  statusFromOutcome,
  SYSTEM_ACTORS,
  type AgentRail,
  type RailActionKey,
  type RailActor,
  type RailCandidateRef,
  type RailItem,
  type RailRoleRef,
} from "@/lib/agent-rail/agent-rail";
import { readWorkspaceAccess } from "@/lib/authz/workspace-access";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

const input = z.object({
  organization_id: z.string().uuid(),
  days: z.number().int().min(1).max(90).optional(),
});

const MAX_ITEMS = 120;

/** Event kinds from the canonical event table that belong on this rail. */
const FEED_EVENTS = [
  "candidate_stage_changed",
  "candidate_published",
  "message_sent",
  "clarification_requested",
  "contact_released",
  "interview_scheduled",
  "interview_completed",
] as const;

function candidateRef(match: Row | undefined): RailCandidateRef | null {
  if (!match) return null;
  const visible = match.client_visibility === "visible";
  const name = (match.candidate_profiles?.full_name as string | null) ?? null;
  return {
    match_id: match.id as string,
    label: visible && name ? name : "A candidate",
    identified: visible && !!name,
  };
}

export const getAgentActivityRail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => input.parse(raw))
  .handler(async ({ data, context }): Promise<AgentRail> => {
    const supabase = context.supabase as Db;
    const userId = context.userId as string;
    const org = data.organization_id;
    const windowDays = data.days ?? 30;
    const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();

    const access = await readWorkspaceAccess(supabase, userId, org);

    const permission = {
      can_read: access.allowed,
      can_decide:
        access.isStaff ||
        access.role === "client_admin" ||
        access.role === "client_editor",
      can_manage_agents: access.isAdmin,
    };

    const empty: AgentRail = {
      organization_id: org,
      permission,
      groups: [],
      roles: [],
      actors: [],
      attention_total: 0,
      window_days: windowDays,
      fetched_at: new Date().toISOString(),
    };

    // Fail closed: a caller without membership gets the restricted state, not
    // an empty rail that looks like "no work happened".
    if (!permission.can_read) return empty;

    const [positionsRes, activityRes, matchesRes, feedRes] = await Promise.all([
      supabase
        .from("positions")
        .select(
          "id, title, status, blueprint_status, blueprint_generated_at, blueprint_attempts, updated_at",
        )
        .eq("organization_id", org)
        .order("updated_at", { ascending: false })
        .limit(200),
      supabase
        .from("agent_activity")
        .select(
          "id, agent_key, outcome, sentence, position_id, candidate_match_id, occurred_at",
        )
        .eq("organization_id", org)
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false })
        .limit(400),
      supabase
        .from("candidate_matches")
        .select(
          `id, position_id, stage, client_visibility, delivered_at, recommendation,
           recommendation_updated_at, contact_released_at, updated_at,
           candidate_profiles(full_name)`,
        )
        .eq("organization_id", org)
        .order("updated_at", { ascending: false })
        .limit(400),
      supabase
        .from("v_activity_feed")
        .select(
          "event_id, event_type, occurred_at, position_id, candidate_match_id, actor_name",
        )
        .eq("organization_id", org)
        .gte("occurred_at", since)
        .in("event_type", FEED_EVENTS as unknown as string[])
        .order("occurred_at", { ascending: false })
        .limit(300),
    ]);

    const positions = (positionsRes.data as Row[]) ?? [];
    const matches = (matchesRes.data as Row[]) ?? [];
    const posById = new Map<string, Row>(positions.map((p) => [p.id as string, p]));
    const matchById = new Map<string, Row>(matches.map((m) => [m.id as string, m]));

    const roleRef = (id: string | null | undefined): RailRoleRef | null => {
      if (!id) return null;
      const p = posById.get(id);
      if (!p) return null;
      return { id: p.id as string, title: (p.title as string) ?? "Untitled role" };
    };

    // Evidence extraction is only readable for matches this workspace can see,
    // so this read is naturally scoped by the same policy as the rest.
    const visibleMatchIds = matches
      .filter((m) => m.client_visibility === "visible")
      .map((m) => m.id as string);
    let evidenceRows: Row[] = [];
    if (visibleMatchIds.length > 0) {
      const { data: ev } = await supabase
        .from("candidate_evidence_items")
        .select("id, candidate_match_id, created_at")
        .in("candidate_match_id", visibleMatchIds.slice(0, 200))
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      evidenceRows = (ev as Row[]) ?? [];
    }

    const items: RailItem[] = [];

    // 1. What the agents themselves recorded doing.
    for (const a of (activityRes.data as Row[]) ?? []) {
      const status = statusFromOutcome(a.outcome as string);
      const match = a.candidate_match_id
        ? matchById.get(a.candidate_match_id as string)
        : undefined;
      const actor: RailActor = {
        key: a.agent_key as string,
        name: agentName(a.agent_key as string),
        kind: "agent",
      };
      const actions: RailActionKey[] = [];
      if (match && candidateRef(match)?.identified) actions.push("open_candidate");
      if (a.position_id && roleRef(a.position_id as string)) actions.push("open_role");
      if (status === "failed" || status === "blocked") {
        if (permission.can_manage_agents) actions.push("pause");
      }
      items.push({
        id: `agent:${a.id}`,
        kind: kindFromAgentKey(a.agent_key as string),
        action: a.sentence as string,
        result:
          status === "done"
            ? "Recorded in this workspace."
            : status === "blocked"
              ? "Held back until a person decides."
              : status === "stopped"
                ? "Stopped before it acted."
                : "The run did not finish. Our team is notified.",
        status,
        actor,
        role: roleRef(a.position_id as string | null),
        candidate: candidateRef(match),
        occurred_at: new Date(a.occurred_at as string).toISOString(),
        count: 1,
        actions,
      });
    }

    // 2. Blueprint compilation, from the role's own recorded state.
    for (const p of positions) {
      const status = p.blueprint_status as string | null;
      const at = (p.blueprint_generated_at as string | null) ?? null;
      const role = roleRef(p.id as string);
      if (status === "failed") {
        items.push({
          id: `blueprint-failed:${p.id}`,
          kind: "blueprint_failed",
          action: `We could not finish the blueprint for ${role?.title ?? "this role"}.`,
          result:
            "Nothing was published from it. You can run it again, or we will pick it up.",
          status: "failed",
          actor: SYSTEM_ACTORS.blueprint!,
          role,
          candidate: null,
          occurred_at: new Date(
            (at ?? (p.updated_at as string)) ?? new Date().toISOString(),
          ).toISOString(),
          count: 1,
          actions: permission.can_decide ? ["retry", "open_role"] : ["open_role"],
        });
        continue;
      }
      if (!at) continue;
      if (at < since) continue;
      const running = status === "analyzing_jd" || status === "queued";
      items.push({
        id: `blueprint:${p.id}`,
        kind: running ? "discovery_run" : "blueprint_compiled",
        action: running
          ? `We are compiling the blueprint for ${role?.title ?? "this role"}.`
          : `The blueprint for ${role?.title ?? "this role"} was compiled.`,
        result: running
          ? "In progress. Nothing to do yet."
          : "Requirements, must-haves and screening questions are ready on the role.",
        status: running ? "in_progress" : "done",
        actor: SYSTEM_ACTORS.blueprint!,
        role,
        candidate: null,
        occurred_at: new Date(at).toISOString(),
        count: 1,
        actions: ["open_role"],
      });
    }

    // 3. Candidates delivered and waiting on a decision — the real approval ask.
    for (const m of matches) {
      if (m.client_visibility !== "visible") continue;
      const cand = candidateRef(m)!;
      const role = roleRef(m.position_id as string | null);
      const delivered = (m.delivered_at as string | null) ?? null;

      if (delivered && delivered >= since) {
        const awaiting = m.stage === "delivered";
        items.push({
          id: `delivered:${m.id}`,
          kind: awaiting ? "approval_requested" : "human_review_completed",
          action: awaiting
            ? `${cand.label} is ready for your decision.`
            : `${cand.label} was released to your workspace after review.`,
          result: awaiting
            ? "Evidence and assessment are attached. Approve to shortlist, or decline with a reason."
            : "Now in your pipeline.",
          status: awaiting ? "needs_you" : "done",
          actor: SYSTEM_ACTORS.review!,
          role,
          candidate: cand,
          occurred_at: new Date(delivered).toISOString(),
          count: 1,
          actions: awaiting
            ? permission.can_decide
              ? ["approve", "reject", "inspect_evidence", "open_candidate"]
              : ["review", "inspect_evidence", "open_candidate"]
            : ["open_candidate"],
        });
      }

      const scoredAt = (m.recommendation_updated_at as string | null) ?? null;
      if (scoredAt && scoredAt >= since) {
        items.push({
          id: `scored:${m.id}`,
          kind: "scores_updated",
          action: `${cand.label}'s assessment was updated.`,
          result: m.recommendation
            ? `Current standing: ${String(m.recommendation).replace(/_/g, " ")}.`
            : "Assessment recorded against this role's requirements.",
          status: "done",
          actor: SYSTEM_ACTORS.scoring!,
          role,
          candidate: cand,
          occurred_at: new Date(scoredAt).toISOString(),
          count: 1,
          actions: ["inspect_evidence", "open_candidate"],
        });
      }
    }

    // 4. Evidence extraction, collapsed per candidate.
    const evidenceByMatch = new Map<string, { count: number; latest: string }>();
    for (const e of evidenceRows) {
      const key = e.candidate_match_id as string;
      const prev = evidenceByMatch.get(key);
      const at = new Date(e.created_at as string).toISOString();
      if (!prev) evidenceByMatch.set(key, { count: 1, latest: at });
      else {
        prev.count += 1;
        if (at > prev.latest) prev.latest = at;
      }
    }
    for (const [matchId, agg] of evidenceByMatch) {
      const m = matchById.get(matchId);
      if (!m) continue;
      const cand = candidateRef(m)!;
      items.push({
        id: `evidence:${matchId}`,
        kind: "evidence_extracted",
        action: `Evidence extracted for ${cand.label}.`,
        result: `${agg.count} finding${agg.count === 1 ? "" : "s"} tied back to the CV and screening answers.`,
        status: "done",
        actor: SYSTEM_ACTORS.evidence!,
        role: roleRef(m.position_id as string | null),
        candidate: cand,
        occurred_at: agg.latest,
        count: agg.count,
        actions: ["inspect_evidence", "open_candidate"],
      });
    }

    // 5. Canonical events: movement, messages, coordination.
    for (const f of (feedRes.data as Row[]) ?? []) {
      const type = f.event_type as string;
      const match = f.candidate_match_id
        ? matchById.get(f.candidate_match_id as string)
        : undefined;
      const cand = candidateRef(match);
      const role = roleRef(f.position_id as string | null);
      const who = (f.actor_name as string | null) ?? null;

      const spec =
        type === "candidate_stage_changed"
          ? {
              kind: "candidate_moved" as const,
              actor: SYSTEM_ACTORS.pipeline!,
              action: `${cand?.label ?? "A candidate"} moved to the next step.`,
              result: "The pipeline and your commitments were updated.",
            }
          : type === "candidate_published"
            ? {
                kind: "human_review_completed" as const,
                actor: SYSTEM_ACTORS.review!,
                action: `${who ? `${who} completed` : "A reviewer completed"} the human review.`,
                result: "The candidate was released to your workspace.",
              }
            : type === "message_sent"
              ? {
                  kind: "message_sent" as const,
                  actor: SYSTEM_ACTORS.messaging!,
                  action: "A message was sent on this role.",
                  result: "It is in your message thread.",
                }
              : type === "clarification_requested"
                ? {
                    kind: "approval_requested" as const,
                    actor: SYSTEM_ACTORS.review!,
                    action: "We asked you a question on this role.",
                    result: "Sourcing continues, but this answer will sharpen it.",
                  }
                : type === "contact_released"
                  ? {
                      kind: "human_review_completed" as const,
                      actor: SYSTEM_ACTORS.review!,
                      action: `Contact details were released for ${cand?.label ?? "a candidate"}.`,
                      result: "You can reach them directly now.",
                    }
                  : {
                      kind: "coordination" as const,
                      actor: SYSTEM_ACTORS.pipeline!,
                      action:
                        type === "interview_completed"
                          ? `An interview with ${cand?.label ?? "a candidate"} was completed.`
                          : `An interview with ${cand?.label ?? "a candidate"} was scheduled.`,
                      result: "Times and attendees are on the interview record.",
                    };

      const needsAnswer = type === "clarification_requested";
      const actions: RailActionKey[] = [];
      if (needsAnswer) actions.push("review");
      if (cand?.identified) actions.push("open_candidate");
      if (role) actions.push("open_role");

      items.push({
        id: `event:${f.event_id}`,
        kind: spec.kind,
        action: spec.action,
        result: spec.result,
        status: needsAnswer ? "needs_you" : "done",
        actor: spec.actor,
        role,
        candidate: cand,
        occurred_at: new Date(f.occurred_at as string).toISOString(),
        count: 1,
        actions,
      });
    }

    const collapsed = collapseItems(items).slice(0, MAX_ITEMS);
    const groups = groupItems(collapsed);

    const roles: RailRoleRef[] = [];
    const seenRole = new Set<string>();
    const actors: RailActor[] = [];
    const seenActor = new Set<string>();
    for (const item of collapsed) {
      if (item.role && !seenRole.has(item.role.id)) {
        seenRole.add(item.role.id);
        roles.push(item.role);
      }
      if (!seenActor.has(item.actor.key)) {
        seenActor.add(item.actor.key);
        actors.push(item.actor);
      }
    }

    return {
      organization_id: org,
      permission,
      groups,
      roles,
      actors,
      attention_total: collapsed.filter(needsAttention).length,
      window_days: windowDays,
      fetched_at: new Date().toISOString(),
    };
  });

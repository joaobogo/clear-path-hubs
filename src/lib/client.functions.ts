// Client workspace service — canonical read + mutation server fns for Phase 8.
// All reads go through the authenticated Supabase client (RLS applies as the caller).
// KPI counts are computed via the canonical service in client-kpi.server.ts so
// every dashboard tile and drill-through view stays reconciled.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { CLIENT_PERMISSIONS, type ClientPermission } from "@/lib/authz";
import { computeRoleLaunchState } from "@/lib/role-launch.server";
import { DECLINE_REASONS } from "@/lib/client-decision-reasons";

import {
  loadKpiRows,
  loadRoleStageDates,
  computeKpis,
  toClientCandidateDTO,
  TOP_FIT_LABELS,
  type MatchStage,
  type KpiRow,
} from "@/lib/client-kpi.server";
import {
  buildPipelineStatusLine,
  buildPipelineActionLabel,
  type PipelineStatusInput,
} from "@/lib/client-pipeline-language";
import { computeRoleProgress } from "@/lib/client-role-progress";
import { computeRoleRisk } from "@/lib/client-role-risk";
import { computeHiringHealth } from "@/lib/client-hiring-health";
import { buildQueue, type QueueItem } from "@/lib/client-decision-queue";
import { computeNextMilestone } from "@/lib/client-next-milestone";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const traceId = () => `cl_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

// ─── Types ──────────────────────────────────────────────────────────────────

export type ClientRole =
  | "client_admin"
  | "client_editor"
  | "client_viewer"
  | "platform_admin"
  | "operations";

// MatchStage and TOP_FIT_LABELS are re-exported from the canonical KPI service
// so existing imports from this module continue to work.
export { TOP_FIT_LABELS };
export type { MatchStage };

// ─── Context resolution ─────────────────────────────────────────────────────

async function resolveContext(supabase: AnyRow, userId: string, orgId?: string) {
  const { data: memberships, error } = await supabase
    .from("memberships")
    .select(
      "organization_id, role, status, permissions, organizations(id, name, industry, parent_organization_id, logo_url, brand_display_name, brand_primary_color, brand_accent_color)",
    )

    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  const clientMemberships = (memberships as AnyRow[]).filter((m) =>
    ["client_admin", "client_editor", "client_viewer"].includes(m.role),
  );
  const staffMemberships = (memberships as AnyRow[]).filter((m) =>
    ["platform_admin", "operations"].includes(m.role),
  );
  const isStaff = staffMemberships.length > 0;
  let active = clientMemberships.find((m) => m.organization_id === orgId);
  if (!active && !orgId) active = clientMemberships[0];
  // Staff can view any org they name.
  if (!active && isStaff && orgId) {
    const { data: org } = await supabase
      .from("organizations")
      .select(
        "id, name, industry, parent_organization_id, logo_url, brand_display_name, brand_primary_color, brand_accent_color",
      )
      .eq("id", orgId)
      .maybeSingle();
    if (org) {
      active = {
        organization_id: org.id,
        role: "client_admin" as const,
        // Staff impersonating an org context get the full client permission set.
        permissions: [...CLIENT_PERMISSIONS],
        organizations: org,
      };
    }
  }
  return { active, memberships: clientMemberships, isStaff };
}

export const getClientContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { orgId?: string }) => input ?? {})
  .handler(async ({ context, data }) => {
    const { active, memberships, isStaff } = await resolveContext(
      context.supabase,
      context.userId,
      data.orgId,
    );
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("full_name, timezone, client_onboarding_dismissed_at")
      .eq("auth_user_id", context.userId)
      .maybeSingle();
    const onboarding = {
      dismissed_at:
        (prof as { client_onboarding_dismissed_at?: string | null } | null)
          ?.client_onboarding_dismissed_at ?? null,
      timezone: (prof as { timezone?: string | null } | null)?.timezone ?? null,
      display_name: (prof as { full_name?: string | null } | null)?.full_name ?? null,
    };
    if (!active) {
      return {
        active: null as null | {
          organization_id: string;
          role: ClientRole;
          name: string;
          industry: string | null;
          parent_organization_id: string | null;
          logo_url: string | null;
          brand_display_name: string | null;
          brand_primary_color: string | null;
          brand_accent_color: string | null;
          parent_name: string | null;
          permissions: ClientPermission[];
        },

        organizations: memberships.map((m) => ({
          id: m.organization_id,
          role: m.role as ClientRole,
          name: m.organizations?.name ?? "Organization",
        })),
        isStaff,
        onboarding,
      };
    }
    const parentId = (active.organizations?.parent_organization_id ?? null) as string | null;
    let parentName: string | null = null;
    if (parentId) {
      const { data: parentOrg } = await context.supabase
        .from("organizations")
        .select("name")
        .eq("id", parentId)
        .maybeSingle();
      parentName = (parentOrg as { name?: string | null } | null)?.name ?? null;
    }
    return {
      active: {
        organization_id: active.organization_id,
        role: active.role as ClientRole,
        name: active.organizations?.name ?? "Organization",
        industry: (active.organizations?.industry ?? null) as string | null,
        parent_organization_id: parentId,
        logo_url: (active.organizations?.logo_url ?? null) as string | null,
        brand_display_name: (active.organizations?.brand_display_name ?? null) as string | null,
        brand_primary_color: (active.organizations?.brand_primary_color ?? null) as string | null,
        brand_accent_color: (active.organizations?.brand_accent_color ?? null) as string | null,
        parent_name: parentName,
        // Server-verified seat permissions. UI uses these to hide controls;
        // RLS + server assertions independently enforce the same rules.
        permissions: (active.permissions ?? []) as ClientPermission[],
      },

      organizations: memberships.map((m) => ({
        id: m.organization_id,
        role: m.role as ClientRole,
        name: m.organizations?.name ?? "Organization",
      })),
      isStaff,
      onboarding,
    };
  });

export const dismissClientOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ client_onboarding_dismissed_at: new Date().toISOString() })
      .eq("auth_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const resetClientOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ client_onboarding_dismissed_at: null })
      .eq("auth_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const brandingSchema = z.object({
  orgId: z.string().uuid(),
  logo_url: z.string().url().max(500).nullable(),
  brand_display_name: z.string().trim().min(1).max(120).nullable(),
  brand_primary_color: z.string().regex(HEX_COLOR).nullable(),
  brand_accent_color: z.string().regex(HEX_COLOR).nullable(),
});

export const updateClientBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof brandingSchema>) => brandingSchema.parse(input))
  .handler(async ({ context, data }) => {
    // Must be a client_admin of this org (or platform staff via RLS).
    const { data: membership } = await context.supabase
      .from("memberships")
      .select("role, status")
      .eq("user_id", context.userId)
      .eq("organization_id", data.orgId)
      .eq("status", "active")
      .maybeSingle();
    const role = (membership as { role?: string } | null)?.role;
    if (role !== "client_admin" && role !== "platform_admin" && role !== "operations") {
      throw new Error("Only client admins can update branding.");
    }
    const { error } = await context.supabase
      .from("organizations")
      .update({
        logo_url: data.logo_url,
        brand_display_name: data.brand_display_name,
        brand_primary_color: data.brand_primary_color,
        brand_accent_color: data.brand_accent_color,
      })
      .eq("id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ─── Canonical KPI service ──────────────────────────────────────────────────
// Definitions live in `@/lib/client-kpi.server` (loadKpiRows, computeKpis,
// isTopMatch, isInInterview). Everything below composes those primitives.

// ─── Overview ───────────────────────────────────────────────────────────────

export const getClientOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const rows = await loadKpiRows(context.supabase, data.orgId);

    const { data: positions, error: positionsError } = await context.supabase
      .from("positions")
      .select("id, title, status, updated_at, created_at")
      .eq("organization_id", data.orgId)
      .in("status", ["active", "paused", "approved"])
      .order("updated_at", { ascending: false });
    const activePositionsList = (positions as AnyRow[]) ?? [];
    const activePositions = activePositionsList.length;
    const kpis = computeKpis(rows, activePositions);

    // ── Hiring health line ──────────────────────────────────────────────────
    // One judgement plus three figures. Every input is a recorded date or a
    // stored commitment; nothing is projected. If any input fails to load we
    // return null so the client shows an error state rather than "on track".
    const allPositionIds = activePositionsList.map((p) => p.id as string);
    const { data: healthCommitmentRows, error: healthCommitmentError } = allPositionIds.length
      ? await context.supabase
          .from("position_commitments")
          .select("position_id, first_shortlist_days, baseline_at")
          .eq("organization_id", data.orgId)
          .in("position_id", allPositionIds)
      : { data: [] as AnyRow[], error: null };

    const nowMs = Date.now();
    const deliveredPositionIds = new Set(
      rows.filter((r) => r.delivered_at != null).map((r) => r.position_id),
    );
    const promisedByPosition = new Map<string, number>();
    for (const c of (healthCommitmentRows as AnyRow[]) ?? []) {
      if (!c.baseline_at || c.first_shortlist_days == null) continue;
      promisedByPosition.set(
        c.position_id as string,
        new Date(c.baseline_at as string).getTime() + Number(c.first_shortlist_days) * 86_400_000,
      );
    }
    const rolesWithoutShortlist = allPositionIds.filter((id) => !deliveredPositionIds.has(id));
    const hiring_health =
      positionsError || healthCommitmentError
        ? null
        : computeHiringHealth({
            openRoles: activePositions,
            awaitingDecision: kpis.awaiting_decision,
            rolesWithoutShortlist: rolesWithoutShortlist.length,
            overdueDecisions: rows.filter(
              (r) =>
                r.stage === "delivered" &&
                r.client_decision_due_at != null &&
                new Date(r.client_decision_due_at).getTime() < nowMs,
            ).length,
            behindScheduleRoles: rolesWithoutShortlist.filter((id) => {
              const promised = promisedByPosition.get(id);
              return promised != null && promised < nowMs;
            }).length,
          });

    // "What's new" — matches delivered in the past 7 days.
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const new_this_week = rows.filter(
      (r) =>
        r.stage === "delivered" &&
        r.delivered_at != null &&
        new Date(r.delivered_at).getTime() >= sevenDaysAgo,
    ).length;

    // Action-required list — items requiring the client's attention.
    const positionsById = new Map<string, AnyRow>(activePositionsList.map((p) => [p.id, p]));
    const positionCounts = new Map<string, number>();
    for (const r of rows) {
      if (r.stage === "delivered") {
        positionCounts.set(r.position_id, (positionCounts.get(r.position_id) ?? 0) + 1);
      }
    }
    const action_required: Array<{ type: string; label: string; href: string; count?: number }> =
      [];
    for (const [pid, count] of positionCounts) {
      const p = positionsById.get(pid);
      action_required.push({
        type: "new_delivered",
        label: `${count} new candidate${count === 1 ? "" : "s"} to review for ${p?.title ?? "position"}`,
        href: `/client/positions/${pid}`,
        count,
      });
    }
    const offerCount = rows.filter((r) => r.stage === "offer").length;
    if (offerCount > 0) {
      action_required.push({
        type: "offer_pending",
        label: `${offerCount} offer${offerCount === 1 ? "" : "s"} awaiting response`,
        href: `/client/candidates?filter=interview`,
        count: offerCount,
      });
    }
    const interviewScheduledCount = rows.filter((r) => r.interview_scheduled).length;
    if (interviewScheduledCount > 0) {
      action_required.push({
        type: "interview_scheduled",
        label: `${interviewScheduledCount} interview${interviewScheduledCount === 1 ? "" : "s"} scheduled — leave feedback after`,
        href: `/client/candidates?filter=interview`,
        count: interviewScheduledCount,
      });
    }

    // "What happens next" — per-position next milestone, only active positions.
    const rowsByPosition = new Map<string, KpiRow[]>();
    for (const r of rows) {
      if (!rowsByPosition.has(r.position_id)) rowsByPosition.set(r.position_id, []);
      rowsByPosition.get(r.position_id)!.push(r);
    }

    // Real stage dates + our own promises — the only inputs to plain-language
    // status and the "at risk" signal. Nothing is inferred or projected.
    const overviewPositionIds = activePositionsList.slice(0, 6).map((p) => p.id as string);
    const overviewStageDates = overviewPositionIds.length
      ? await loadRoleStageDates(context.supabase, data.orgId, overviewPositionIds)
      : new Map();

    const { data: commitmentRows } = overviewPositionIds.length
      ? await context.supabase
          .from("position_commitments")
          .select("position_id, first_shortlist_days, baseline_at")
          .eq("organization_id", data.orgId)
          .in("position_id", overviewPositionIds)
      : { data: [] as AnyRow[] };
    const commitmentByPosition = new Map<string, AnyRow>(
      ((commitmentRows as AnyRow[]) ?? []).map((c) => [c.position_id as string, c]),
    );

    const maxIso = (values: Array<string | null | undefined>) =>
      values
        .filter((v): v is string => Boolean(v))
        .sort()
        .at(-1) ?? null;
    const minIso = (values: Array<string | null | undefined>) =>
      values.filter((v): v is string => Boolean(v)).sort()[0] ?? null;

    const whats_next = activePositionsList.slice(0, 6).map((p) => {
      const posRows = rowsByPosition.get(p.id) ?? [];
      let next = "Awaiting first candidates";
      if (posRows.some((r) => r.stage === "offer")) next = "Offer response";
      else if (posRows.some((r) => r.interview_active || r.stage === "interview_process"))
        next = "Interview outcome";
      else if (posRows.some((r) => r.stage === "shortlisted")) next = "Send interview requests";
      else if (posRows.some((r) => r.stage === "delivered")) next = "Review new candidates";

      const dates = overviewStageDates.get(p.id as string) ?? {
        sourcing: null,
        screening: null,
        shortlist: null,
        offer: null,
      };
      const progress = computeRoleProgress({
        status: p.status as string,
        briefedAt: (p.created_at as string | null) ?? null,
        sourcingStartedAt: dates.sourcing,
        screeningStartedAt: dates.screening,
        shortlistStartedAt: dates.shortlist,
        offerStartedAt: dates.offer,
      });

      const awaiting = posRows.filter((r) => r.stage === "delivered");
      const toConfirm = posRows.filter((r) => r.interview_needs_confirmation);
      const commitment = commitmentByPosition.get(p.id as string);
      const promisedShortlistBy =
        commitment?.baseline_at && commitment?.first_shortlist_days != null
          ? new Date(
              new Date(commitment.baseline_at as string).getTime() +
                Number(commitment.first_shortlist_days) * 86_400_000,
            ).toISOString()
          : null;

      const lastMovementAt = maxIso([
        p.updated_at as string | null,
        ...posRows.map((r) => r.stage_entered_at),
        ...posRows.map((r) => r.delivered_at),
        dates.offer,
        dates.shortlist,
        dates.screening,
        dates.sourcing,
      ]);

      const risk = computeRoleRisk({
        status: p.status as string,
        lastMovementAt,
        awaitingDecision: awaiting.length,
        oldestAwaitingDecisionAt: minIso(awaiting.map((r) => r.delivered_at ?? r.stage_entered_at)),
        interviewsToConfirm: toConfirm.length,
        oldestInterviewToConfirmAt: minIso(
          toConfirm.map((r) => r.interview_requested_at ?? r.stage_entered_at),
        ),
        promisedShortlistBy,
        shortlistDeliveredAt: dates.shortlist,
      });

      return {
        position_id: p.id as string,
        title: p.title as string,
        status: p.status as string,
        next,
        delivered_pending: awaiting.length,
        // Plain-language stage, when it started, and how long it has been there.
        stage_label: progress.currentLabel,
        stage_hint: progress.steps[progress.currentIndex]?.hint ?? "",
        stage_entered_at: progress.currentEnteredAt,
        days_in_stage: progress.daysInCurrentStage,
        stage_caption: progress.caption,
        last_movement_at: lastMovementAt,
        promised_shortlist_by: promisedShortlistBy,
        shortlist_delivered_at: dates.shortlist,
        at_risk: risk.atRisk,
        risk_reason: risk.reason,
        risk_cause: risk.cause,
      };
    });

    // ── Decision queue ──────────────────────────────────────────────────────
    // The only work list on the client's first screen. Four real sources:
    // candidates delivered and awaiting review, interview feedback still
    // outstanding, offers awaiting a response, and information requests from
    // the recruiting team. Each item carries the role, what it concerns, its
    // recorded due date and when the wait started; ordering, deduping and
    // overdue grouping happen in the pure module.
    const queueRows = rows.filter(
      (r) => r.stage === "delivered" || r.interview_needs_confirmation || r.stage === "offer",
    );
    const queueNames = new Map<string, string>();
    if (queueRows.length > 0) {
      const { data: queueMatches } = await context.supabase
        .from("candidate_matches")
        .select("id, candidate_profiles(full_name)")
        .in(
          "id",
          queueRows.map((r) => r.id),
        );
      for (const m of (queueMatches as AnyRow[]) ?? []) {
        queueNames.set(m.id as string, (m.candidate_profiles?.full_name as string) ?? "Candidate");
      }
    }
    const titleByPosition = new Map<string, string>(
      activePositionsList.map((p) => [p.id as string, p.title as string]),
    );

    const queueItems: QueueItem[] = queueRows.map((r) => {
      const concerns = queueNames.get(r.id) ?? "Candidate";
      const role_title = titleByPosition.get(r.position_id) ?? "Your role";
      const base = {
        concerns,
        role_title,
        position_id: r.position_id,
        subject_id: r.id,
      };
      if (r.interview_needs_confirmation) {
        return {
          ...base,
          key: `interview:${r.id}`,
          kind: "interview" as const,
          due_at: r.next_interview_at ?? null,
          waiting_since: r.interview_requested_at ?? r.stage_entered_at,
          action: "Confirm a time",
          to: "/client/interviews",
        };
      }
      if (r.stage === "offer") {
        return {
          ...base,
          key: `offer:${r.id}`,
          kind: "offer" as const,
          due_at: r.client_decision_due_at ?? null,
          waiting_since: r.stage_entered_at,
          action: "Follow up",
          to: "/client/offers",
        };
      }
      return {
        ...base,
        key: `decision:${r.id}`,
        kind: "decision" as const,
        due_at: r.client_decision_due_at ?? null,
        waiting_since: r.delivered_at ?? r.stage_entered_at,
        action: "Review candidate",
        to: "/client/candidates",
      };
    });

    // Interview feedback outstanding: the interview happened, no scorecard yet.
    // Feedback is due 2 days after the interview ends — a date derived from the
    // recorded completion, not a guess about intent.
    const { data: completedInterviews } = await context.supabase
      .from("interviews")
      .select("id, candidate_match_id, position_id, completed_at, status")
      .eq("organization_id", data.orgId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: true })
      .limit(50);
    const completedList = (completedInterviews as AnyRow[]) ?? [];
    const scoredInterviewIds = new Set<string>();
    if (completedList.length > 0) {
      const { data: cards } = await context.supabase
        .from("interview_scorecards")
        .select("interview_id")
        .in(
          "interview_id",
          completedList.map((i) => i.id as string),
        );
      for (const c of (cards as AnyRow[]) ?? []) {
        scoredInterviewIds.add(c.interview_id as string);
      }
    }
    for (const iv of completedList) {
      if (scoredInterviewIds.has(iv.id as string)) continue;
      const matchId = iv.candidate_match_id as string | null;
      const completedAt = iv.completed_at as string | null;
      queueItems.push({
        key: `feedback:${iv.id}`,
        kind: "feedback",
        concerns: matchId ? (queueNames.get(matchId) ?? "Candidate") : "Candidate",
        role_title: titleByPosition.get(iv.position_id as string) ?? "Your role",
        position_id: (iv.position_id as string) ?? null,
        subject_id: matchId,
        due_at: completedAt
          ? new Date(new Date(completedAt).getTime() + 2 * 86_400_000).toISOString()
          : null,
        waiting_since: completedAt,
        action: "Add feedback",
        to: "/client/interviews",
      });
    }

    // Information requests from the recruiting team — open tasks on this org.
    const { data: openTasks } = await context.supabase
      .from("tasks")
      .select("id, title, position_id, due_at, created_at, blocking")
      .eq("organization_id", data.orgId)
      .is("deleted_at", null)
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: true })
      .limit(50);
    for (const t of (openTasks as AnyRow[]) ?? []) {
      queueItems.push({
        key: `task:${t.id}`,
        kind: "info_request",
        concerns: (t.title as string) ?? "A question from your recruiter",
        role_title: titleByPosition.get(t.position_id as string) ?? "Your account",
        position_id: (t.position_id as string) ?? null,
        subject_id: null,
        due_at: (t.due_at as string) ?? null,
        waiting_since: (t.created_at as string) ?? null,
        action: "Answer",
        to: "/client/tasks",
      });
    }

    // Ordered, deduped and grouped once, on the server, so every surface that
    // reads this payload sees the same queue.
    const queueGroups = buildQueue(queueItems);
    const decision_queue = [...queueGroups.overdue, ...queueGroups.upcoming];
    const decision_queue_meta = {
      /** How many candidates, interviews, offers and requests were examined. */
      checked: rows.length + completedList.length + ((openTasks as AnyRow[]) ?? []).length,
      overdue: queueGroups.overdue.length,
      /** Nearest promised first-shortlist date still ahead of us. */
      next_expected_at:
        Array.from(promisedByPosition.values())
          .filter((ms) => ms > nowMs)
          .sort((a, b) => a - b)
          .map((ms) => new Date(ms).toISOString())[0] ?? null,
    };

    // ── What happens next ───────────────────────────────────────────────────
    // One milestone per active role, so "when do I see candidates?" is answered
    // on screen instead of by email. Dates come only from stored commitments
    // and recorded due dates; roles whose commitment failed to load are marked
    // so the client sees an error row rather than a silently missing role.
    const feedbackDueByPosition = new Map<string, string>();
    for (const iv of completedList) {
      if (scoredInterviewIds.has(iv.id as string)) continue;
      const pid = iv.position_id as string | null;
      const completedAt = iv.completed_at as string | null;
      if (!pid || !completedAt) continue;
      const due = new Date(new Date(completedAt).getTime() + 2 * 86_400_000).toISOString();
      const existing = feedbackDueByPosition.get(pid);
      if (!existing || due < existing) feedbackDueByPosition.set(pid, due);
    }
    const offerDueByPosition = new Map<string, string>();
    for (const r of rows) {
      if (r.stage !== "offer" || !r.client_decision_due_at) continue;
      const existing = offerDueByPosition.get(r.position_id);
      if (!existing || r.client_decision_due_at < existing) {
        offerDueByPosition.set(r.position_id, r.client_decision_due_at);
      }
    }

    const next_milestones = activePositionsList.map((p) => {
      const pid = p.id as string;
      const posRows = rowsByPosition.get(pid) ?? [];
      // A commitment read failure must not read as "no date committed".
      if (healthCommitmentError) {
        return {
          position_id: pid,
          title: p.title as string,
          error: true as const,
        };
      }
      const promised = promisedByPosition.get(pid);
      return {
        ...computeNextMilestone({
          position_id: pid,
          title: p.title as string,
          awaiting_review: posRows.filter((r) => r.stage === "delivered").length,
          has_offer: posRows.some((r) => r.stage === "offer"),
          has_interview: posRows.some((r) => r.interview_active || r.stage === "interview_process"),
          promised_shortlist_by: promised != null ? new Date(promised).toISOString() : null,
          shortlist_delivered_at:
            posRows
              .map((r) => r.delivered_at)
              .filter((v): v is string => Boolean(v))
              .sort()[0] ?? null,
          feedback_due_at: feedbackDueByPosition.get(pid) ?? null,
          offer_response_due_at: offerDueByPosition.get(pid) ?? null,
        }),
        error: false as const,
      };
    });
    const next_milestones_failed = Boolean(positionsError);

    // Latest delivered candidates (top 4 — kept concise).
    const { data: latestMatches } = await context.supabase
      .from("candidate_matches")
      .select(
        `id, stage, delivered_at, position_id,
         candidate_profiles(id, full_name, headline, location, availability, years_experience, summary),
         positions(id, title),
         score_runs:approved_score_run_id (score, fit_label, explanation, result, requirement_coverage, evidence)`,
      )
      .eq("organization_id", data.orgId)
      .eq("client_visibility", "visible")
      .order("delivered_at", { ascending: false })
      .limit(4);
    const latest_candidates = ((latestMatches as AnyRow[]) ?? []).map(toClientCandidateDTO);

    // Recent messages (last 3).
    const { data: recentMessages } = await context.supabase
      .from("messages")
      .select("id, body, created_at, sender_user_id, thread_id")
      .eq("thread_id", data.orgId)
      .order("created_at", { ascending: false })
      .limit(3);

    // "What changed" — filter to client-relevant events only (never internal
    // processing chatter). Whitelist the actions we surface.
    const CLIENT_RELEVANT_ACTIONS = [
      "candidate_match.stage_changed",
      "client.shortlist",
      "client.request_interview",
      "client.offer",
      "client.hire",
      "client.not_moving_forward",
      "client.submit_feedback",
      "position.approved",
      "position.activated",
      "position.paused",
    ];
    const { data: events } = await context.supabase
      .from("audit_events")
      .select("id, action, entity_type, created_at")
      .eq("organization_id", data.orgId)
      .in("action", CLIENT_RELEVANT_ACTIONS)
      .order("created_at", { ascending: false })
      .limit(6);

    const lastEvent = (events as AnyRow[] | undefined)?.[0];
    const last_updated: string | null =
      lastEvent?.created_at ?? activePositionsList[0]?.updated_at ?? null;

    return {
      kpis,
      hiring_health,

      active_positions: activePositions,
      new_this_week,
      action_required,
      whats_next,
      decision_queue,
      decision_queue_meta,
      next_milestones,
      next_milestones_failed,
      latest_candidates,
      recent_messages: (recentMessages as AnyRow[]) ?? [],
      recent_activity: (events as AnyRow[]) ?? [],
      last_updated,
    };
  });

// ─── Positions ──────────────────────────────────────────────────────────────

export const getClientPositions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; status?: string }) =>
    z
      .object({
        orgId: z.string().uuid(),
        status: z.enum(["active", "draft", "paused", "closed"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const statusFilter = (data.status === "closed"
      ? (["closed", "archived"] as const)
      : data.status
        ? ([data.status] as const)
        : (["active", "draft", "paused", "closed", "archived"] as const)) as unknown as string[];
    const { data: positions, error } = await context.supabase
      .from("positions")
      .select(
        "id, title, status, location, work_model, employment_type, seniority, updated_at, created_at, published_at, approved_at",
      )
      .eq("organization_id", data.orgId)
      .in("status", statusFilter as never)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = await loadKpiRows(context.supabase, data.orgId);
    const stageDates = await loadRoleStageDates(
      context.supabase,
      data.orgId,
      (positions as AnyRow[]).map((p) => p.id as string),
    );
    const byPosition = new Map<string, KpiRow[]>();
    for (const r of rows) {
      if (!byPosition.has(r.position_id)) byPosition.set(r.position_id, []);
      byPosition.get(r.position_id)!.push(r);
    }
    return (positions as AnyRow[]).map((p) => {
      const posRows = byPosition.get(p.id) ?? [];
      const kpi = computeKpis(posRows, 0);
      const language = pipelineLanguageInput(posRows, p.status);
      return {
        ...p,

        kpis: kpi,
        pipeline_line: buildPipelineStatusLine(language),
        progress: computeRoleProgress({
          status: String(p.status),
          briefedAt: (p.approved_at as string | null) ?? (p.created_at as string | null),
          sourcingStartedAt: stageDates.get(p.id)?.sourcing ?? (p.published_at as string | null),
          screeningStartedAt: stageDates.get(p.id)?.screening ?? null,
          shortlistStartedAt: stageDates.get(p.id)?.shortlist ?? null,
          offerStartedAt: stageDates.get(p.id)?.offer ?? null,
        }),
        next_milestone: nextMilestoneFor(posRows, p.status),
        action_required: buildPipelineActionLabel(language),
      };
    });
  });

/** Map canonical rows onto the client-language vocabulary. */
function pipelineLanguageInput(rows: KpiRow[], status: string): PipelineStatusInput {
  const scheduled = rows.filter((r) => r.interview_scheduled);
  const nextInterviewAt =
    scheduled
      .map((r) => r.next_interview_at)
      .filter((v): v is string => Boolean(v))
      .sort()[0] ?? null;
  return {
    status,
    awaitingReview: rows.filter((r) => r.stage === "delivered").length,
    shortlisted: rows.filter((r) => r.stage === "shortlisted").length,
    interviewsToConfirm: rows.filter((r) => r.interview_needs_confirmation).length,
    interviewsScheduled: scheduled.length,
    nextInterviewAt,
    offers: rows.filter((r) => r.stage === "offer").length,
    hires: rows.filter((r) => r.stage === "hired").length,
    totalCandidates: rows.length,
  };
}

function nextMilestoneFor(rows: KpiRow[], status: string): string | null {
  if (status === "draft") return "Awaiting intake approval";
  if (status === "paused") return "Position paused";
  if (status === "closed" || status === "archived") return null;
  if (rows.some((r) => r.stage === "offer")) return "Offer response";
  if (rows.some((r) => r.interview_active || r.stage === "interview_process"))
    return "Interview outcome";
  if (rows.some((r) => r.stage === "shortlisted")) return "Interview requests";
  if (rows.length > 0) return "Review new candidates";
  return "Awaiting first candidates";
}

export const getClientPositionDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; positionId: string }) =>
    z.object({ orgId: z.string().uuid(), positionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: position, error } = await context.supabase
      .from("positions")
      .select(
        `id, title, status, visibility, location, work_model, employment_type, seniority, department,
         description, requirements, preferred_requirements, dealbreakers, openings,
         compensation, work_authorization, intake_context, evaluation_weights,
         blueprint, blueprint_status, blueprint_generated_at, blueprint_confirmed_at,
         jd_file_name, jd_source, company_research,
         published_at, approved_at, submitted_at, closed_at, created_at, updated_at`,
      )

      .eq("organization_id", data.orgId)
      .eq("id", data.positionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!position) return null;

    // Client-visible candidates only. Wrong-tenant / unpublished filtered at source.
    const { data: matches } = await context.supabase
      .from("candidate_matches")
      .select(
        `id, stage, admin_status, delivered_at, approved_score_run_id,
         candidate_profiles(id, full_name, headline, location),
         score_runs:approved_score_run_id (score, fit_label, explanation)`,
      )
      .eq("organization_id", data.orgId)
      .eq("position_id", data.positionId)
      .eq("client_visibility", "visible")
      .order("delivered_at", { ascending: false });

    // Recent activity — sanitized safe audit trail for this position.
    // Filter out internal admin_note / scoring_weight / score_run.* actions.
    const { data: rawActivity } = await context.supabase
      .from("audit_events")
      .select("id, action, created_at, actor_user_id")
      .eq("organization_id", data.orgId)
      .eq("entity_id", data.positionId)
      .order("created_at", { ascending: false })
      .limit(20);
    const SAFE_ACTION_PREFIXES = [
      "position.",
      "candidate_match.stage",
      "candidate_match.publish",
      "interview.",
      "client_decision.",
      "message.external",
    ];
    const activity = ((rawActivity as AnyRow[]) ?? [])
      .filter((a) => SAFE_ACTION_PREFIXES.some((p) => String(a.action ?? "").startsWith(p)))
      .slice(0, 10);

    // Pipeline counts (visible only, matches server truth).
    const stageCounts: Record<string, number> = {
      delivered: 0,
      shortlisted: 0,
      interview_process: 0,
      offer: 0,
      hired: 0,
      not_moving_forward: 0,
    };
    for (const m of (matches as AnyRow[]) ?? []) {
      const s = String(m.stage);
      if (s in stageCounts) stageCounts[s]! += 1;
    }
    const openings = Math.max(1, Number(position.openings ?? 1));
    const hires = stageCounts.hired ?? 0;
    const remaining = Math.max(0, openings - hires);

    // Interview state for the plain-language status line.
    const matchIdList = ((matches as AnyRow[]) ?? []).map((m) => m.id as string);
    let interviewsToConfirm = 0;
    let interviewsScheduled = 0;
    let nextInterviewAt: string | null = null;
    if (matchIdList.length > 0) {
      const { data: ivs } = await context.supabase
        .from("interviews")
        .select("candidate_match_id, status, scheduled_at")
        .in("candidate_match_id", matchIdList)
        .in("status", ["requested", "scheduling", "scheduled"]);
      const confirmSet = new Set<string>();
      const scheduledSet = new Set<string>();
      for (const iv of (ivs as AnyRow[]) ?? []) {
        if (iv.status === "scheduled") {
          scheduledSet.add(iv.candidate_match_id);
          const at = iv.scheduled_at as string | null;
          if (at && (!nextInterviewAt || at < nextInterviewAt)) nextInterviewAt = at;
        } else {
          confirmSet.add(iv.candidate_match_id);
        }
      }
      interviewsToConfirm = confirmSet.size;
      interviewsScheduled = scheduledSet.size;
    }
    const pipelineLine = buildPipelineStatusLine({
      status: String(position.status),
      awaitingReview: stageCounts.delivered ?? 0,
      shortlisted: stageCounts.shortlisted ?? 0,
      interviewsToConfirm,
      interviewsScheduled,
      nextInterviewAt,
      offers: stageCounts.offer ?? 0,
      hires,
      totalCandidates: ((matches as AnyRow[]) ?? []).length,
    });

    const positionStageDates = (
      await loadRoleStageDates(context.supabase, data.orgId, [data.positionId])
    ).get(data.positionId);

    // Role launch state — timeline + channels, derived from real records only.
    const { data: campaigns } = await context.supabase
      .from("outreach_campaigns")
      .select("id, name, channel, status, started_at, ended_at, created_at")
      .eq("organization_id", data.orgId)
      .eq("position_id", data.positionId)
      .order("created_at", { ascending: true });

    const { count: applicationCount } = await context.supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("position_id", data.positionId);

    const deliveredAt =
      ((matches as AnyRow[]) ?? [])
        .map((m) => m.delivered_at as string | null)
        .filter((v): v is string => Boolean(v))
        .sort()[0] ?? null;

    // Verified outreach activity for this role (RLS-scoped to the org).
    const campaignIds = ((campaigns as AnyRow[]) ?? []).map((c) => c.id as string);
    let touches: AnyRow[] = [];
    if (campaignIds.length > 0) {
      const { data: touchRows } = await context.supabase
        .from("outreach_touches")
        .select(
          "id, candidate_profile_id, sent_at, delivered_at, replied_at, engagement_state, is_test_record, created_at",
        )
        .eq("organization_id", data.orgId)
        .in("campaign_id", campaignIds);
      touches = (touchRows as AnyRow[]) ?? [];
    }

    // Source attribution — real application rows only.
    const { data: appSources } = await context.supabase
      .from("applications")
      .select("source_kind")
      .eq("position_id", data.positionId);
    const attributionMap = new Map<string, number>();
    for (const a of (appSources as AnyRow[]) ?? []) {
      const src = String(a.source_kind ?? "").trim();
      if (!src) continue;
      attributionMap.set(src, (attributionMap.get(src) ?? 0) + 1);
    }
    const attribution = [...attributionMap.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    const launch = computeRoleLaunchState({
      position,
      campaigns: ((campaigns as AnyRow[]) ?? []).filter((c) => !c.is_test_record),
      matchCount: ((matches as AnyRow[]) ?? []).length,
      deliveredAt,
      applicationCount: applicationCount ?? 0,
      touches,
      attribution,
    });

    return {
      position,
      matches: (matches as AnyRow[]) ?? [],
      activity,
      launch,
      summary: {
        openings,
        hires,
        remaining,
        delivered: stageCounts.delivered,
        shortlisted: stageCounts.shortlisted,
        interviewing: stageCounts.interview_process,
        offers: stageCounts.offer,
        not_moving_forward: stageCounts.not_moving_forward,
        pipeline_line: pipelineLine,
      },
      progress: computeRoleProgress({
        status: String(position.status),
        briefedAt:
          (position.approved_at as string | null) ?? (position.created_at as string | null),
        sourcingStartedAt: positionStageDates?.sourcing ?? (position.published_at as string | null),
        screeningStartedAt: positionStageDates?.screening ?? null,
        shortlistStartedAt: positionStageDates?.shortlist ?? null,
        offerStartedAt: positionStageDates?.offer ?? null,
      }),
    };
  });

// ─── Candidates ─────────────────────────────────────────────────────────────

export type CandidateFilter =
  | "all"
  | "new"
  | "top"
  | "shortlisted"
  | "interview"
  | "hired"
  | "not_moving_forward";

export const getClientCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      orgId: string;
      filter?: CandidateFilter;
      positionId?: string;
      minScore?: number;
      fitBand?: string;
      location?: string;
    }) =>
      z
        .object({
          orgId: z.string().uuid(),
          filter: z
            .enum(["all", "new", "top", "shortlisted", "interview", "hired", "not_moving_forward"])
            .optional(),
          positionId: z.string().uuid().optional(),
          minScore: z.number().optional(),
          fitBand: z.string().optional(),
          location: z.string().optional(),
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("candidate_matches")
      .select(
        `id, stage, delivered_at, position_id, application_id,
         candidate_profiles(id, full_name, headline, location, timezone, availability, years_experience, summary, experience, skills, education, languages, work_authorization, linkedin_url, portfolio_url, certifications),
         positions(id, title),
         score_runs:approved_score_run_id (score, fit_label, explanation, result, requirement_coverage, evidence)`,
      )
      .eq("organization_id", data.orgId)
      .eq("client_visibility", "visible");

    if (data.positionId) q = q.eq("position_id", data.positionId);

    const { data: rows, error } = await q.order("delivered_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Map to sanitized client-safe DTOs first — filters below operate on those.
    let dtos = ((rows as AnyRow[]) ?? []).map(toClientCandidateDTO);

    if (data.filter && data.filter !== "all") {
      dtos = dtos.filter((d) => {
        if (data.filter === "new") return d.stage === "delivered";
        if (data.filter === "shortlisted") return d.stage === "shortlisted";
        if (data.filter === "hired") return d.stage === "hired";
        if (data.filter === "not_moving_forward") return d.stage === "not_moving_forward";
        if (data.filter === "interview")
          return d.stage === "interview_process" || d.stage === "offer";
        if (data.filter === "top")
          return d.fit_label != null && (TOP_FIT_LABELS as readonly string[]).includes(d.fit_label);
        return true;
      });
    }
    if (data.minScore != null) dtos = dtos.filter((d) => (d.score ?? 0) >= data.minScore!);
    if (data.fitBand) dtos = dtos.filter((d) => d.fit_label === data.fitBand);
    if (data.location) {
      const needle = data.location.toLowerCase();
      dtos = dtos.filter((d) => (d.candidate.location ?? "").toLowerCase().includes(needle));
    }

    return dtos;
  });

export const getClientCandidate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; matchId: string }) =>
    z.object({ orgId: z.string().uuid(), matchId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: match, error } = await context.supabase
      .from("candidate_matches")
      .select(
        `id, stage, delivered_at, position_id, application_id, candidate_profile_id,
         candidate_profiles(id, full_name, headline, location, timezone, availability, years_experience, summary, experience, skills, education, languages, work_authorization, linkedin_url, portfolio_url, certifications, compensation_preferences),
         positions(id, title, location, work_model, requirements, preferred_requirements, compensation),
         applications(id, source, applied_at, created_at),
         score_runs:approved_score_run_id (score, fit_label, explanation, result, evidence, requirement_coverage, completed_at, engine_version, blueprint_version, contradiction_status, must_have_coverage, preferred_coverage)`,
      )
      .eq("organization_id", data.orgId)
      .eq("id", data.matchId)
      .eq("client_visibility", "visible")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!match) return null;

    const applicationId = (match as AnyRow).application_id;
    const candidateProfileId = (match as AnyRow).candidate_profile_id;
    const auditIds = [data.matchId, applicationId, candidateProfileId].filter(Boolean) as string[];
    const [{ data: interviews }, { data: decisions }, answersRes, auditRes] = await Promise.all([
      context.supabase
        .from("interviews")
        .select("id, status, requested_at, scheduled_at, completed_at, notes")
        .eq("candidate_match_id", data.matchId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("client_decisions")
        .select("id, decision, feedback, created_at")
        .eq("candidate_match_id", data.matchId)
        .order("created_at", { ascending: false }),
      applicationId
        ? context.supabase
            .from("application_answers")
            .select("id, answer, screening_questions(question, display_order)")
            .eq("application_id", applicationId)
        : Promise.resolve({ data: [] as AnyRow[] }),
      auditIds.length > 0
        ? context.supabase
            .from("audit_events")
            .select(
              "id, action, entity_type, entity_id, actor_user_id, before_state, after_state, created_at",
            )
            .eq("organization_id", data.orgId)
            .in("entity_id", auditIds)
            .order("created_at", { ascending: false })
            .limit(30)
        : Promise.resolve({ data: [] as AnyRow[] }),
    ]);

    const answers = ((answersRes as AnyRow).data as AnyRow[]) ?? [];
    answers.sort(
      (a, b) =>
        (a.screening_questions?.display_order ?? 0) - (b.screening_questions?.display_order ?? 0),
    );
    const matchWithAnswers = {
      ...(match as AnyRow),
      application_answers: answers,
      audit_events: ((auditRes as AnyRow).data as AnyRow[]) ?? [],
    };

    return {
      candidate: toClientCandidateDTO(matchWithAnswers),
      interviews: (interviews as AnyRow[]) ?? [],
      decisions: (decisions as AnyRow[]) ?? [],
    };
  });

// ─── Stage transitions ──────────────────────────────────────────────────────
//
// Backend validation: no matter where the transition originates (button, kanban
// drag, keyboard), it flows through this function and cannot bypass the graph.

// Canonical transition matrix — mirrored by client kanban STAGE_GRAPH.
const STAGE_GRAPH: Record<MatchStage, MatchStage[]> = {
  delivered: ["shortlisted", "interview_process", "not_moving_forward"],
  shortlisted: ["interview_process", "not_moving_forward"],
  interview_process: ["offer", "shortlisted", "not_moving_forward"],
  offer: ["hired", "not_moving_forward"],
  hired: [],
  not_moving_forward: ["shortlisted"],
};

/**
 * Reject if the caller is platform staff acting on an org where they hold no
 * active client-role membership AND no active interactive support session
 * exists for that org. Throws the typed `SUPPORT_VIEW_READ_ONLY` error the
 * spec requires; UI translates it to a friendly toast.
 */
async function assertNotSupportViewReadOnly(supabase: AnyRow, userId: string, orgId: string) {
  const { data: isClientEditor } = await supabase.rpc("is_org_editor", {
    _user: userId,
    _org: orgId,
  });
  if (isClientEditor === true) return;
  const { data: isStaff } = await supabase.rpc("is_platform_staff", {
    _user: userId,
  });
  if (isStaff !== true) throw new Error("forbidden");
  // Staff — allow only when an interactive support session is currently open.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: interactive } = await supabaseAdmin
    .from("support_sessions")
    .select("id")
    .eq("actor_user_id", userId)
    .eq("organization_id", orgId)
    .eq("mode", "interactive")
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (!interactive) throw new Error("SUPPORT_VIEW_READ_ONLY");
}

async function assertEditor(supabase: AnyRow, userId: string, orgId: string) {
  await assertNotSupportViewReadOnly(supabase, userId, orgId);
}

async function loadMatch(supabase: AnyRow, orgId: string, matchId: string) {
  const { data, error } = await supabase
    .from("candidate_matches")
    .select(
      "id, stage, organization_id, position_id, application_id, candidate_profile_id, client_visibility",
    )
    .eq("id", matchId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("match_not_found");
  if (data.client_visibility !== "visible") throw new Error("match_not_visible");
  return data as AnyRow;
}

async function writeAudit(
  supabase: AnyRow,
  opts: {
    actor: string;
    action: string;
    entity_type: string;
    entity_id: string;
    organization_id: string;
    before?: unknown;
    after?: unknown;
    trace_id: string;
  },
) {
  await supabase.from("audit_events").insert({
    actor_user_id: opts.actor,
    action: opts.action,
    entity_type: opts.entity_type,
    entity_id: opts.entity_id,
    organization_id: opts.organization_id,
    before_state: (opts.before ?? null) as never,
    after_state: (opts.after ?? null) as never,
    trace_id: opts.trace_id,
  });
}

export const moveMatchStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { orgId: string; matchId: string; toStage: MatchStage; reason?: string }) =>
      z
        .object({
          orgId: z.string().uuid(),
          matchId: z.string().uuid(),
          toStage: z.enum([
            "delivered",
            "shortlisted",
            "interview_process",
            "offer",
            "hired",
            "not_moving_forward",
          ]),
          reason: z.string().trim().max(2000).optional(),
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    const trace = traceId();
    await assertEditor(context.supabase, context.userId, data.orgId);
    const match = await loadMatch(context.supabase, data.orgId, data.matchId);
    const from = match.stage as MatchStage;
    if (from === data.toStage) return { ok: true, trace_id: trace };
    const allowed = STAGE_GRAPH[from] ?? [];
    if (!allowed.includes(data.toStage)) {
      throw new Error(`invalid_transition:${from}->${data.toStage}`);
    }
    // Business rule: rejecting a candidate requires a reason.
    if (data.toStage === "not_moving_forward" && !data.reason?.trim()) {
      throw new Error("reason_required");
    }
    const { error } = await context.supabase
      .from("candidate_matches")
      .update({ stage: data.toStage })
      .eq("id", data.matchId)
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);

    // Canonical side-effects: mirror clientAction so any transition path
    // (button, drag, keyboard menu) produces identical decision + interview trails.
    const stageToDecision: Partial<Record<MatchStage, string>> = {
      shortlisted: "shortlist",
      interview_process: "request_interview",
      offer: "offer",
      hired: "hire",
      not_moving_forward: "not_moving_forward",
    };
    const decision = stageToDecision[data.toStage];
    if (decision) {
      await context.supabase.from("client_decisions").insert({
        candidate_match_id: data.matchId,
        organization_id: data.orgId,
        decision: decision as never,
        actor_user_id: context.userId,
        feedback: data.reason?.trim() || null,
      });
    }
    if (data.toStage === "interview_process" && from !== "interview_process") {
      await context.supabase.from("interviews").insert({
        candidate_match_id: data.matchId,
        organization_id: data.orgId,
        position_id: match.position_id as string,
        candidate_submission_id: (match.application_id as string) ?? null,
        status: "requested",
        requested_at: new Date().toISOString(),
        created_by: context.userId,
      });
    }

    await writeAudit(context.supabase, {
      actor: context.userId,
      action: "candidate_match.stage_changed",
      entity_type: "candidate_matches",
      entity_id: data.matchId,
      organization_id: data.orgId,
      before: { stage: from },
      after: { stage: data.toStage },
      trace_id: trace,
    });

    try {
      const { emitEventFromServer } = await import("./notifications.functions");
      const stageToEvent: Partial<
        Record<MatchStage, "client_shortlisted" | "interview_requested" | "candidate_hired">
      > = {
        shortlisted: "client_shortlisted",
        interview_process: "interview_requested",
        hired: "candidate_hired",
      };
      const evt = stageToEvent[data.toStage];
      if (evt) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: staff } = await supabaseAdmin
          .from("memberships")
          .select("user_id")
          .in("role", ["platform_admin", "operations"])
          .eq("status", "active");
        const adminRecipients = (staff ?? []).map((s) => ({
          user_id: s.user_id as string,
          audience: "admin" as const,
          link_path: `/admin/candidates`,
        }));
        const { data: matchRow } = await supabaseAdmin
          .from("candidate_matches")
          .select(
            "candidate_profile_id, application_id, position_id, candidate_profiles:candidate_profile_id(user_id)",
          )
          .eq("id", data.matchId)
          .maybeSingle();
        const cpUser =
          (matchRow?.candidate_profiles as { user_id: string | null } | null)?.user_id ?? null;
        const candidateRecipients = cpUser
          ? [
              {
                user_id: cpUser,
                audience: "candidate" as const,
                link_path: `/me/applications/${matchRow?.application_id ?? ""}`,
              },
            ]
          : [];
        await emitEventFromServer({
          event: evt,
          scope: `${data.matchId}:${data.toStage}`,
          organization_id: data.orgId,
          position_id: matchRow?.position_id ?? null,
          application_id: matchRow?.application_id ?? null,
          candidate_match_id: data.matchId,
          candidate_profile_id: matchRow?.candidate_profile_id ?? null,
          actor_user_id: context.userId,
          recipients: [...adminRecipients, ...candidateRecipients],
        });
      }
      // Always record the canonical status change itself, even when it has no
      // notification copy. Scope keys on the exact transition, so replaying the
      // same move never produces a second activity row.
      await emitEventFromServer({
        event: "candidate_stage_changed",
        scope: `${data.matchId}:${from}->${data.toStage}`,
        organization_id: data.orgId,
        position_id: (match.position_id as string) ?? null,
        application_id: (match.application_id as string) ?? null,
        candidate_match_id: data.matchId,
        actor_user_id: context.userId,
        payload: { from, to: data.toStage },
      });
    } catch (emitErr) {
      console.error("[moveMatchStage] emit failed", trace, emitErr);
    }
    return { ok: true, trace_id: trace };
  });

/** How long a client can take a decision back without asking anyone. */
export const UNDO_WINDOW_MS = 5 * 60 * 1000;

/**
 * Take back the last decision on a match.
 *
 * Deliberately bypasses STAGE_GRAPH: an undo is a correction of the caller's
 * own action inside the undo window, not a new forward transition. Anything
 * older than the window, or taken by someone else, is refused.
 */
export const undoClientDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { orgId: string; matchId: string; toStage: MatchStage; decisionId?: string }) =>
      z
        .object({
          orgId: z.string().uuid(),
          matchId: z.string().uuid(),
          toStage: z.enum([
            "delivered",
            "shortlisted",
            "interview_process",
            "offer",
            "hired",
            "not_moving_forward",
          ]),
          decisionId: z.string().uuid().optional(),
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    const trace = traceId();
    await assertEditor(context.supabase, context.userId, data.orgId);
    const match = await loadMatch(context.supabase, data.orgId, data.matchId);
    const from = match.stage as MatchStage;

    const cutoff = new Date(Date.now() - UNDO_WINDOW_MS).toISOString();
    let q = context.supabase
      .from("client_decisions")
      .select("id, decision, created_at, from_stage")
      .eq("candidate_match_id", data.matchId)
      .eq("organization_id", data.orgId)
      .eq("actor_user_id", context.userId)
      .is("reversed_at", null)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data.decisionId) q = q.eq("id", data.decisionId);
    const { data: recent, error: recentErr } = await q.maybeSingle();
    if (recentErr) throw new Error(recentErr.message);
    if (!recent) throw new Error("undo_window_expired");

    // Prefer the stage recorded on the decision itself over the caller's hint.
    const backTo = ((recent as AnyRow).from_stage as MatchStage | null) ?? data.toStage;

    if (from !== backTo) {
      const { error } = await context.supabase
        .from("candidate_matches")
        .update({ stage: backTo })
        .eq("id", data.matchId)
        .eq("organization_id", data.orgId);
      if (error) throw new Error(error.message);
    }

    // An interview requested by the undone decision must not survive it.
    if (recent.decision === "request_interview") {
      await context.supabase
        .from("interviews")
        .delete()
        .eq("candidate_match_id", data.matchId)
        .eq("organization_id", data.orgId)
        .eq("status", "requested");
    }

    // The decision is never erased — it is marked reversed, so the audit trail
    // carries both the decision and its reversal.
    await context.supabase
      .from("client_decisions")
      .update({
        reversed_at: new Date().toISOString(),
        reversed_by: context.userId,
      } as never)
      .eq("id", recent.id)
      .eq("organization_id", data.orgId);

    await writeAudit(context.supabase, {
      actor: context.userId,
      action: "client.undo_decision",
      entity_type: "candidate_matches",
      entity_id: data.matchId,
      organization_id: data.orgId,
      before: { stage: from, decision: recent.decision, decision_id: recent.id },
      after: { stage: backTo, decision: null, reversed: true },
      trace_id: trace,
    });

    return { ok: true, trace_id: trace, undone: recent.decision as string, toStage: backTo };
  });

/**
 * Decisions this user can still take back, so the Undo affordance survives a
 * page refresh instead of living only inside a toast.
 */
export const listReversibleDecisions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    // Viewers simply have nothing to undo — never an error on a dashboard read.
    try {
      await assertEditor(context.supabase, context.userId, data.orgId);
    } catch {
      return [];
    }
    const cutoff = new Date(Date.now() - UNDO_WINDOW_MS).toISOString();
    const { data: rows, error } = await context.supabase
      .from("client_decisions")
      .select("id, candidate_match_id, decision, created_at, from_stage")
      .eq("organization_id", data.orgId)
      .eq("actor_user_id", context.userId)
      .is("reversed_at", null)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      match_id: (r as AnyRow).candidate_match_id as string,
      decision: r.decision as string,
      created_at: r.created_at as string,
      from_stage: ((r as AnyRow).from_stage as MatchStage | null) ?? null,
      expires_at: new Date(
        new Date(r.created_at as string).getTime() + UNDO_WINDOW_MS,
      ).toISOString(),
    }));
  });

// ─── Client actions ─────────────────────────────────────────────────────────

const ACTION_TO_STAGE: Partial<Record<string, MatchStage>> = {
  shortlist: "shortlisted",
  request_interview: "interview_process",
  offer: "offer",
  not_moving_forward: "not_moving_forward",
  hire: "hired",
};

export type ClientActionKey =
  | "shortlist"
  | "request_interview"
  | "request_more_information"
  | "hold"
  | "request_contact_release"
  | "not_moving_forward"
  | "submit_feedback"
  | "offer"
  | "hire";

const CLIENT_ACTION_KEYS = [
  "shortlist",
  "request_interview",
  "request_more_information",
  "hold",
  "request_contact_release",
  "not_moving_forward",
  "submit_feedback",
  "offer",
  "hire",
] as const;

// Actions that must carry a structured reason, so admins always know *why*.
const REASON_REQUIRED: ReadonlySet<string> = new Set([
  "not_moving_forward",
  "request_more_information",
  "hold",
]);

const CLIENT_DECLINE_CODES: ReadonlySet<string> = new Set(DECLINE_REASONS.map((r) => r.code));

export const clientAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      orgId: string;
      matchId: string;
      action: ClientActionKey;
      feedback?: string;
      reasonCode?: string;
      signals?: string[];
      rating?: number;
    }) =>
      z
        .object({
          orgId: z.string().uuid(),
          matchId: z.string().uuid(),
          action: z.enum(CLIENT_ACTION_KEYS),
          feedback: z.string().max(4000).optional(),
          reasonCode: z.string().max(64).optional(),
          signals: z.array(z.string().max(64)).max(12).optional(),
          rating: z.number().int().min(1).max(5).optional(),
        })
        .superRefine((v, ctx) => {
          if (REASON_REQUIRED.has(v.action) && !v.reasonCode) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["reasonCode"],
              message: "A reason is required for this action.",
            });
          }
          // Declines must use the shared rejection vocabulary so reason counts
          // reconcile across the client and admin surfaces.
          if (
            v.action === "not_moving_forward" &&
            v.reasonCode &&
            !CLIENT_DECLINE_CODES.has(v.reasonCode)
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["reasonCode"],
              message: "Pick a reason from the list.",
            });
          }
          if (v.reasonCode === "other" && !(v.feedback ?? "").trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["feedback"],
              message: "Please add a short explanation.",
            });
          }
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    const trace = traceId();
    await assertEditor(context.supabase, context.userId, data.orgId);
    const match = await loadMatch(context.supabase, data.orgId, data.matchId);

    const nextStage = ACTION_TO_STAGE[data.action];
    if (nextStage && match.stage !== nextStage) {
      const allowed = STAGE_GRAPH[match.stage as MatchStage] ?? [];
      if (!allowed.includes(nextStage)) {
        throw new Error(`invalid_transition:${match.stage}->${nextStage}`);
      }
      const { error } = await context.supabase
        .from("candidate_matches")
        .update({ stage: nextStage })
        .eq("id", data.matchId)
        .eq("organization_id", data.orgId);
      if (error) throw new Error(error.message);
    }

    if (data.action === "request_interview") {
      await context.supabase.from("interviews").insert({
        candidate_match_id: data.matchId,
        organization_id: data.orgId,
        position_id: match.position_id as string,
        candidate_submission_id: (match.application_id as string) ?? null,
        status: "requested",
        requested_at: new Date().toISOString(),
        created_by: context.userId,
      });
    }

    // Persist a decision that mirrors the client's intent.
    const decisionMap = {
      shortlist: "shortlist",
      request_interview: "request_interview",
      request_more_information: "request_information",
      hold: "hold",
      request_contact_release: "request_contact_release",
      submit_feedback: "feedback",
      not_moving_forward: "not_moving_forward",
      offer: "offer",
      hire: "hire",
    } as const;
    const decision = (decisionMap as Record<string, string>)[data.action] ?? null;
    if (decision) {
      await context.supabase.from("client_decisions").insert({
        candidate_match_id: data.matchId,
        organization_id: data.orgId,
        decision: decision as never,
        feedback: data.feedback?.trim() || null,
        reason_code: data.reasonCode ?? null,
        details: (data.signals?.length || data.rating
          ? { signals: data.signals ?? [], rating: data.rating ?? null }
          : null) as never,
        from_stage: match.stage as string,
        actor_user_id: context.userId,
      });
    }

    await writeAudit(context.supabase, {
      actor: context.userId,
      action: `client.${data.action}`,
      entity_type: "candidate_matches",
      entity_id: data.matchId,
      organization_id: data.orgId,
      before: { stage: match.stage },
      after: {
        stage: nextStage ?? match.stage,
        feedback: data.feedback ?? null,
        reason_code: data.reasonCode ?? null,
      },
      trace_id: trace,
    });

    // Notify the TaaSFlow team so every client action lands on the admin side.
    try {
      const { emitEventFromServer } = await import("./notifications.functions");
      const actionToEvent: Partial<Record<string, string>> = {
        shortlist: "client_shortlisted",
        request_interview: "interview_requested",
        request_more_information: "client_information_requested",
        hold: "client_hold",
        request_contact_release: "contact_release_requested",
        submit_feedback: "client_feedback_submitted",
        not_moving_forward: "client_declined",
        hire: "candidate_hired",
      };
      const evt = actionToEvent[data.action];
      if (evt) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: staff } = await supabaseAdmin
          .from("memberships")
          .select("user_id")
          .in("role", ["platform_admin", "operations"])
          .eq("status", "active");
        await emitEventFromServer({
          event: evt as never,
          scope: `${data.matchId}:${data.action}:${Date.now()}`,
          organization_id: data.orgId,
          position_id: (match.position_id as string) ?? null,
          application_id: (match.application_id as string) ?? null,
          candidate_match_id: data.matchId,
          candidate_profile_id: (match.candidate_profile_id as string) ?? null,
          actor_user_id: context.userId,
          payload: { reason_code: data.reasonCode ?? null },
          recipients: (staff ?? []).map((s) => ({
            user_id: s.user_id as string,
            audience: "admin" as const,
            link_path: `/admin/candidates`,
          })),
        });
      }
    } catch (emitErr) {
      console.error("[clientAction] emit failed", trace, emitErr);
    }

    return { ok: true, trace_id: trace };
  });

// ─── Messages ───────────────────────────────────────────────────────────────
// Threads are org-scoped; we key them on the organization id itself so a client
// workspace has one persistent conversation with the TaaSFlow team.

export const getClientMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("id, sender_user_id, body, created_at, recipient_context")
      .eq("thread_id", data.orgId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows as AnyRow[]) ?? [];
  });

export const sendClientMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; body: string }) =>
    z.object({ orgId: z.string().uuid(), body: z.string().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    // Sender must be a real client member of the org, OR staff in an active
    // interactive support session. Read-only support view cannot send.
    await assertNotSupportViewReadOnly(context.supabase, context.userId, data.orgId);
    const { data: row, error } = await context.supabase
      .from("messages")
      .insert({
        thread_id: data.orgId,
        sender_user_id: context.userId,
        body: data.body,
        recipient_context: { org_id: data.orgId, thread_kind: "client_workspace" },
      })
      .select("id, sender_user_id, body, created_at, recipient_context")
      .single();
    if (error) throw new Error(error.message);
    // The message row id is the natural idempotency scope: one message, one event.
    try {
      const { emitEventFromServer } = await import("./notifications.functions");
      await emitEventFromServer({
        event: "message_sent",
        scope: `message:${(row as AnyRow).id}`,
        organization_id: data.orgId,
        actor_user_id: context.userId,
        link_path: "/client/messages",
      });
    } catch (e) {
      console.error("[sendClientMessage] emit failed", e);
    }
    return row as AnyRow;
  });

// ─── Team ───────────────────────────────────────────────────────────────────

export const getClientTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    // Only admins/editors of this org (or staff) can view the team.
    const { data: canRead } = await context.supabase.rpc("is_org_editor", {
      _user: context.userId,
      _org: data.orgId,
    });
    const { data: staff } = await context.supabase.rpc("is_platform_staff", {
      _user: context.userId,
    });
    if (canRead !== true && staff !== true) throw new Error("forbidden");
    const { data: rows, error } = await context.supabase
      .from("memberships")
      .select("user_id, role, status, created_at, profiles:user_id(full_name, email)")
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);
    return (rows as AnyRow[]) ?? [];
  });

// ─── Team mutations ─────────────────────────────────────────────────────────
// Only client_admin (or staff in an interactive support session) may mutate.
// Support view read-only is enforced through assertNotSupportViewReadOnly.

async function assertOrgAdmin(supabase: AnyRow, userId: string, orgId: string): Promise<void> {
  const { data: isAdmin } = await supabase.rpc("is_org_admin", {
    _user: userId,
    _org: orgId,
  });
  const { data: staff } = await supabase.rpc("is_platform_staff", { _user: userId });
  if (isAdmin !== true && staff !== true) throw new Error("Forbidden");
}

const clientMemberRoleZ = z.enum(["client_admin", "client_editor", "client_viewer"]);

export const inviteClientMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      orgId: string;
      email: string;
      role: "client_admin" | "client_editor" | "client_viewer";
    }) =>
      z
        .object({
          orgId: z.string().uuid(),
          email: z
            .string()
            .email()
            .max(200)
            .transform((s) => s.trim().toLowerCase()),
          role: clientMemberRoleZ,
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    await assertNotSupportViewReadOnly(context.supabase, context.userId, data.orgId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Seat cap is enforced here, server-side: the owner seat plus the
    // organization's recruiter seat limit. Invited seats are already reserved,
    // so a pending invitation counts against the cap.
    const [{ data: capOrg }, { data: capSeats }] = await Promise.all([
      supabaseAdmin
        .from("organizations")
        .select("client_seat_limit")
        .eq("id", data.orgId)
        .maybeSingle(),
      supabaseAdmin
        .from("memberships")
        .select("id, status")
        .eq("organization_id", data.orgId)
        .in("role", ["client_admin", "client_editor", "client_viewer"])
        .in("status", ["active", "invited"]),
    ]);
    const seatLimit =
      (capOrg as { client_seat_limit?: number | null } | null)?.client_seat_limit ?? 3;
    const seatsUsed = ((capSeats as { id: string }[] | null) ?? []).length;
    if (seatsUsed >= seatLimit + 1) {
      throw new Error(
        `Seat limit reached — this organization has ${seatsUsed} of ${seatLimit + 1} seats in use. Release a seat before inviting someone new.`,
      );
    }

    // Resolve or invite the auth user by email.
    let authUserId: string | null = null;
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("auth_user_id")
      .eq("email", data.email)
      .maybeSingle();

    if (existingProfile?.auth_user_id) {
      authUserId = existingProfile.auth_user_id;
    } else {
      const { data: invite, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        data.email,
        { data: { invited_org_id: data.orgId } },
      );
      if (invErr || !invite?.user?.id)
        throw new Error(invErr?.message ?? "Failed to send invitation");
      authUserId = invite.user.id;
      await supabaseAdmin
        .from("profiles")
        .upsert(
          { auth_user_id: authUserId, email: data.email, status: "active" },
          { onConflict: "auth_user_id" },
        );
    }

    // Prevent duplicate membership.
    const { data: existing } = await supabaseAdmin
      .from("memberships")
      .select("id, status")
      .eq("organization_id", data.orgId)
      .eq("user_id", authUserId)
      .maybeSingle();
    if (existing) {
      if (existing.status === "removed") {
        const { error: uErr } = await supabaseAdmin
          .from("memberships")
          .update({ status: "invited", role: data.role })
          .eq("id", existing.id);
        if (uErr) throw new Error(uErr.message);
        return { ok: true, reactivated: true };
      }
      throw new Error("This person is already on your team.");
    }

    const { error: mErr } = await supabaseAdmin.from("memberships").insert({
      user_id: authUserId,
      organization_id: data.orgId,
      role: data.role,
      status: "invited",
    });
    if (mErr) throw new Error(mErr.message);
    try {
      const { emitEventFromServer } = await import("./notifications.functions");
      await emitEventFromServer({
        event: "member_invited",
        scope: `member:${data.orgId}:${authUserId}:invited`,
        organization_id: data.orgId,
        actor_user_id: context.userId,
        link_path: "/client/settings",
        payload: { role: data.role },
      });
    } catch (e) {
      console.error("[inviteClientMember] emit failed", e);
    }
    return { ok: true };
  });

export const resendClientInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; userId: string }) =>
    z.object({ orgId: z.string().uuid(), userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    await assertNotSupportViewReadOnly(context.supabase, context.userId, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("auth_user_id", data.userId)
      .maybeSingle();
    if (!profile?.email) throw new Error("Member email not found");
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(profile.email, {
      data: { invited_org_id: data.orgId },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateClientMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      orgId: string;
      userId: string;
      role: "client_admin" | "client_editor" | "client_viewer";
    }) =>
      z
        .object({
          orgId: z.string().uuid(),
          userId: z.string().uuid(),
          role: clientMemberRoleZ,
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    await assertNotSupportViewReadOnly(context.supabase, context.userId, data.orgId);
    // Prevent removing the last admin.
    if (data.role !== "client_admin") {
      const { data: admins } = await context.supabase
        .from("memberships")
        .select("user_id")
        .eq("organization_id", data.orgId)
        .eq("role", "client_admin")
        .eq("status", "active");
      const adminIds = new Set(((admins as AnyRow[]) ?? []).map((a) => a.user_id));
      adminIds.delete(data.userId);
      if (adminIds.size === 0) throw new Error("You need at least one workspace admin.");
    }
    const { error } = await context.supabase
      .from("memberships")
      .update({ role: data.role })
      .eq("organization_id", data.orgId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setClientMemberStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; userId: string; status: "active" | "suspended" }) =>
    z
      .object({
        orgId: z.string().uuid(),
        userId: z.string().uuid(),
        status: z.enum(["active", "suspended"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    await assertNotSupportViewReadOnly(context.supabase, context.userId, data.orgId);
    if (data.status === "suspended") {
      const { data: admins } = await context.supabase
        .from("memberships")
        .select("user_id, role")
        .eq("organization_id", data.orgId)
        .eq("status", "active");
      const activeAdmins = ((admins as AnyRow[]) ?? []).filter(
        (a) => a.role === "client_admin" && a.user_id !== data.userId,
      );
      if (activeAdmins.length === 0)
        throw new Error("You need at least one active workspace admin.");
    }
    const { error } = await context.supabase
      .from("memberships")
      .update({ status: data.status })
      .eq("organization_id", data.orgId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeClientMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; userId: string }) =>
    z.object({ orgId: z.string().uuid(), userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    await assertNotSupportViewReadOnly(context.supabase, context.userId, data.orgId);
    if (data.userId === context.userId) throw new Error("You can't remove yourself.");
    const { data: admins } = await context.supabase
      .from("memberships")
      .select("user_id, role")
      .eq("organization_id", data.orgId)
      .eq("status", "active");
    const others = ((admins as AnyRow[]) ?? []).filter(
      (a) => a.role === "client_admin" && a.user_id !== data.userId,
    );
    if (others.length === 0)
      throw new Error("You need at least one workspace admin before removing this member.");
    // Soft-remove: preserves auth user + audit trail.
    const { error } = await context.supabase
      .from("memberships")
      .update({ status: "removed" })
      .eq("organization_id", data.orgId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    try {
      const { emitEventFromServer } = await import("./notifications.functions");
      await emitEventFromServer({
        event: "member_removed",
        scope: `member:${data.orgId}:${data.userId}:removed`,
        organization_id: data.orgId,
        actor_user_id: context.userId,
        link_path: "/client/settings",
      });
    } catch (e) {
      console.error("[removeClientMember] emit failed", e);
    }
    return { ok: true };
  });

// ─── Settings ───────────────────────────────────────────────────────────────
// Company Profile (org-level, admin-only, audited), Notifications & Timezone
// (user-scoped, any active member — Client Viewer blocked at handler + UI).

const notifPrefsShape = {
  candidate_delivered: true,
  interview_request: true,
  new_message: true,
  offer_update: true,
  hire_update: true,
  email_enabled: true,
  digest: "immediate" as "immediate" | "daily" | "weekly" | "off",
};

const companyProfileZ = z.object({
  orgId: z.string().uuid(),
  name: z.string().trim().min(2).max(200),
  website: z
    .string()
    .trim()
    .max(300)
    .transform((s) => (s === "" ? null : s))
    .nullable()
    .refine(
      (v) => v == null || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v),
      "Website must start with http(s):// and be a valid URL.",
    ),
  industry: z
    .string()
    .trim()
    .max(120)
    .transform((s) => (s === "" ? null : s))
    .nullable(),
  headquarters: z
    .string()
    .trim()
    .max(200)
    .transform((s) => (s === "" ? null : s))
    .nullable(),
  phone: z
    .string()
    .trim()
    .max(60)
    .transform((s) => (s === "" ? null : s))
    .nullable(),
});

const notifPrefsZ = z.object({
  orgId: z.string().uuid(),
  candidate_delivered: z.boolean(),
  interview_request: z.boolean(),
  new_message: z.boolean(),
  offer_update: z.boolean(),
  hire_update: z.boolean(),
  email_enabled: z.boolean(),
  digest: z.enum(["immediate", "daily", "weekly", "off"]),
});

const timezoneZ = z.object({
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .refine((v) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "Invalid IANA timezone."),
});

export const getClientSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    // Tenant gate — must be an active member (or platform staff).
    const { data: member } = await context.supabase
      .from("memberships")
      .select("role, status")
      .eq("organization_id", data.orgId)
      .eq("user_id", context.userId)
      .eq("status", "active")
      .maybeSingle();
    const { data: staff } = await context.supabase.rpc("is_platform_staff", {
      _user: context.userId,
    });
    if (!member && staff !== true) throw new Error("Forbidden");

    const [{ data: org }, { data: prefs }, { data: profile }] = await Promise.all([
      context.supabase
        .from("organizations")
        .select(
          "id, name, website, industry, headquarters, phone, onboarding_status, dashboard_status, status",
        )
        .eq("id", data.orgId)
        .maybeSingle(),
      context.supabase
        .from("client_notification_preferences")
        .select("*")
        .eq("user_id", context.userId)
        .eq("organization_id", data.orgId)
        .maybeSingle(),
      context.supabase
        .from("profiles")
        .select("timezone, email, full_name")
        .eq("auth_user_id", context.userId)
        .maybeSingle(),
    ]);
    if (!org) throw new Error("Workspace not found");
    return {
      role: (member?.role ?? "operations") as ClientRole,
      approved:
        (org as AnyRow).onboarding_status === "active" ||
        (org as AnyRow).dashboard_status === "active" ||
        (org as AnyRow).status === "active",
      company: {
        id: (org as AnyRow).id as string,
        name: (org as AnyRow).name as string,
        website: ((org as AnyRow).website as string | null) ?? "",
        industry: ((org as AnyRow).industry as string | null) ?? "",
        headquarters: ((org as AnyRow).headquarters as string | null) ?? "",
        phone: ((org as AnyRow).phone as string | null) ?? "",
      },
      notifications: {
        candidate_delivered:
          (prefs as AnyRow)?.candidate_delivered ?? notifPrefsShape.candidate_delivered,
        interview_request:
          (prefs as AnyRow)?.interview_request ?? notifPrefsShape.interview_request,
        new_message: (prefs as AnyRow)?.new_message ?? notifPrefsShape.new_message,
        offer_update: (prefs as AnyRow)?.offer_update ?? notifPrefsShape.offer_update,
        hire_update: (prefs as AnyRow)?.hire_update ?? notifPrefsShape.hire_update,
        email_enabled: (prefs as AnyRow)?.email_enabled ?? notifPrefsShape.email_enabled,
        digest: ((prefs as AnyRow)?.digest ?? notifPrefsShape.digest) as
          | "immediate"
          | "daily"
          | "off",
      },
      account: {
        email: ((profile as AnyRow)?.email as string | null) ?? "",
        full_name: ((profile as AnyRow)?.full_name as string | null) ?? "",
        timezone: ((profile as AnyRow)?.timezone as string | null) ?? "UTC",
      },
    };
  });

export const updateClientCompanyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof companyProfileZ>) => companyProfileZ.parse(input))
  .handler(async ({ context, data }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    await assertNotSupportViewReadOnly(context.supabase, context.userId, data.orgId);
    const trace_id = `st-cp-${crypto.randomUUID()}`;
    const { data: before } = await context.supabase
      .from("organizations")
      .select("name, website, industry, headquarters, phone")
      .eq("id", data.orgId)
      .maybeSingle();
    const patch = {
      name: data.name,
      website: data.website,
      industry: data.industry,
      headquarters: data.headquarters,
      phone: data.phone,
    };
    const { data: updated, error } = await context.supabase
      .from("organizations")
      .update(patch)
      .eq("id", data.orgId)
      .select("name, website, industry, headquarters, phone")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await writeAudit(context.supabase, {
      actor: context.userId,
      action: "client.settings.company_profile.update",
      entity_type: "organizations",
      entity_id: data.orgId,
      organization_id: data.orgId,
      before,
      after: updated,
      trace_id,
    });
    return { ok: true, company: updated };
  });

export const updateClientNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof notifPrefsZ>) => notifPrefsZ.parse(input))
  .handler(async ({ context, data }) => {
    // Any active member may manage their own — but block viewers per product rule.
    const { data: member } = await context.supabase
      .from("memberships")
      .select("role, status")
      .eq("organization_id", data.orgId)
      .eq("user_id", context.userId)
      .eq("status", "active")
      .maybeSingle();
    const { data: staff } = await context.supabase.rpc("is_platform_staff", {
      _user: context.userId,
    });
    if (!member && staff !== true) throw new Error("Forbidden");
    if (member?.role === "client_viewer") throw new Error("Read-only role");
    await assertNotSupportViewReadOnly(context.supabase, context.userId, data.orgId);

    const trace_id = `st-np-${crypto.randomUUID()}`;
    const { data: before } = await context.supabase
      .from("client_notification_preferences")
      .select("*")
      .eq("user_id", context.userId)
      .eq("organization_id", data.orgId)
      .maybeSingle();
    const row = {
      user_id: context.userId,
      organization_id: data.orgId,
      candidate_delivered: data.candidate_delivered,
      interview_request: data.interview_request,
      new_message: data.new_message,
      offer_update: data.offer_update,
      hire_update: data.hire_update,
      email_enabled: data.email_enabled,
      digest: data.digest,
    };
    const { data: after, error } = await context.supabase
      .from("client_notification_preferences")
      .upsert(row, { onConflict: "user_id,organization_id" })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await writeAudit(context.supabase, {
      actor: context.userId,
      action: "client.settings.notifications.update",
      entity_type: "client_notification_preferences",
      entity_id: `${context.userId}:${data.orgId}`,
      organization_id: data.orgId,
      before,
      after,
      trace_id,
    });
    return { ok: true, notifications: after };
  });

export const updateClientTimezone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; timezone: string }) =>
    z.object({ orgId: z.string().uuid() }).merge(timezoneZ).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: member } = await context.supabase
      .from("memberships")
      .select("role, status")
      .eq("organization_id", data.orgId)
      .eq("user_id", context.userId)
      .eq("status", "active")
      .maybeSingle();
    const { data: staff } = await context.supabase.rpc("is_platform_staff", {
      _user: context.userId,
    });
    if (!member && staff !== true) throw new Error("Forbidden");
    if (member?.role === "client_viewer") throw new Error("Read-only role");
    await assertNotSupportViewReadOnly(context.supabase, context.userId, data.orgId);

    const trace_id = `st-tz-${crypto.randomUUID()}`;
    const { data: before } = await context.supabase
      .from("profiles")
      .select("timezone")
      .eq("auth_user_id", context.userId)
      .maybeSingle();
    const { data: after, error } = await context.supabase
      .from("profiles")
      .update({ timezone: data.timezone })
      .eq("auth_user_id", context.userId)
      .select("timezone")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await writeAudit(context.supabase, {
      actor: context.userId,
      action: "client.settings.timezone.update",
      entity_type: "profiles",
      entity_id: context.userId,
      organization_id: data.orgId,
      before,
      after,
      trace_id,
    });
    return { ok: true, timezone: (after as AnyRow)?.timezone as string };
  });

/* ------------------------------------------------------------------ */
/* Role blueprint confirmation                                         */
/* ------------------------------------------------------------------ */

const confirmBlueprintSchema = z.object({
  orgId: z.string().uuid(),
  positionId: z.string().uuid(),
});

/**
 * The client signs off on the AI-generated blueprint. This never changes the
 * generated content — it only records that a human reviewed it, which the
 * admin review centre and the delivery gate both read.
 */
export const confirmRoleBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof confirmBlueprintSchema>) =>
    confirmBlueprintSchema.parse(input),
  )
  .handler(async ({ context, data }) => {
    const trace_id = crypto.randomUUID();
    const { data: before } = await context.supabase
      .from("positions")
      .select("id, blueprint_status, blueprint_confirmed_at")
      .eq("organization_id", data.orgId)
      .eq("id", data.positionId)
      .maybeSingle();
    if (!before) throw new Error("Position not found");

    const { data: after, error } = await context.supabase
      .from("positions")
      .update({ blueprint_confirmed_at: new Date().toISOString() })
      .eq("organization_id", data.orgId)
      .eq("id", data.positionId)
      .select("id, blueprint_confirmed_at")
      .maybeSingle();
    if (error) throw new Error(error.message);

    await writeAudit(context.supabase, {
      actor: context.userId,
      action: "client.position.blueprint.confirm",
      entity_type: "positions",
      entity_id: data.positionId,
      organization_id: data.orgId,
      before,
      after,
      trace_id,
    });
    return { ok: true as const, confirmed_at: (after as AnyRow)?.blueprint_confirmed_at as string };
  });

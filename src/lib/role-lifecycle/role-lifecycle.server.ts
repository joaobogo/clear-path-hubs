/**
 * Role lifecycle — reads.
 *
 * Every query here runs through the caller's RLS-scoped client, so the
 * lifecycle can never show more than the workspace is already entitled to see:
 *
 *  - Candidate counts only include matches with client_visibility = 'visible'.
 *  - No internal machinery is returned: no job ids, trace ids, engine or
 *    rubric versions, model names or raw error strings.
 *  - This function derives a *view* over existing records. It writes nothing
 *    and introduces no new status field.
 */

import {
  computeRoleLifecycle,
  type LifecycleSignals,
  type RoleLifecycle,
} from "@/lib/role-lifecycle/role-lifecycle";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  needs_clarification: "Clarification needed",
  approved: "Active search",
  active: "Active search",
  paused: "Paused",
  filled: "Filled",
  closed: "Closed",
  archived: "Closed",
};

const min = (a: string | null, b: string | null | undefined) =>
  b && (!a || b < a) ? b : a;
const max = (a: string | null, b: string | null | undefined) =>
  b && (!a || b > a) ? b : a;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

/**
 * Lifecycle for one role, from the caller's RLS-scoped client.
 * Server-only helper so both the thin server-function wrapper and the single
 * role-detail payload can reuse it without a second round trip.
 */
export async function loadRoleLifecycle(
  supabase: Client,
  data: { orgId: string; positionId: string },
): Promise<RoleLifecycle | null> {

    const { data: position, error } = await supabase
      .from("positions")
      .select(
        `id, title, status, openings, created_at, updated_at, submitted_at, approved_at,
         published_at, closed_at, blueprint_status, blueprint_generated_at, blueprint_confirmed_at`,
      )
      .eq("organization_id", data.orgId)
      .eq("id", data.positionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!position) return null;

    const p = position as Row;

    const [campaignsRes, appsRes, matchesRes, historyRes] = await Promise.all([
      supabase
        .from("outreach_campaigns")
        .select("id, status, started_at, created_at, is_test_record")
        .eq("organization_id", data.orgId)
        .eq("position_id", data.positionId),
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("position_id", data.positionId),
      supabase
        .from("candidate_matches")
        .select("id, stage, delivered_at, created_at, approved_score_run_id")
        .eq("organization_id", data.orgId)
        .eq("position_id", data.positionId)
        .eq("client_visibility", "visible"),
      supabase
        .from("candidate_stage_history")
        .select("to_stage, created_at")
        .eq("organization_id", data.orgId)
        .eq("position_id", data.positionId),
    ]);

    const campaigns = ((campaignsRes.data as Row[]) ?? []).filter((c) => !c.is_test_record);
    const matches = (matchesRes.data as Row[]) ?? [];
    const matchIds = matches.map((m) => m.id as string);

    let interviews: Row[] = [];
    let decisions: Row[] = [];
    if (matchIds.length > 0) {
      const [ivRes, decRes] = await Promise.all([
        supabase
          .from("interviews")
          .select("candidate_match_id, status, requested_at, scheduled_at, completed_at, created_at")
          .in("candidate_match_id", matchIds),
        supabase
          .from("client_decisions")
          .select("candidate_match_id, decision, created_at")
          .in("candidate_match_id", matchIds),
      ]);
      interviews = (ivRes.data as Row[]) ?? [];
      decisions = (decRes.data as Row[]) ?? [];
    }

    // ── Aggregate verified signals ─────────────────────────────────────────
    let discoveryStartedAt: string | null = null;
    let activeCampaigns = 0;
    for (const c of campaigns) {
      discoveryStartedAt = min(discoveryStartedAt, c.started_at ?? c.created_at);
      if (["running", "active", "live"].includes(String(c.status ?? ""))) activeCampaigns += 1;
    }

    let firstCandidateAt: string | null = null;
    let firstAssessmentAt: string | null = null;
    let firstDeliveredAt: string | null = null;
    let assessedCount = 0;
    let awaitingReview = 0;
    let shortlistedCount = 0;
    let offerCount = 0;
    let hires = 0;
    for (const m of matches) {
      firstCandidateAt = min(firstCandidateAt, m.created_at ?? m.delivered_at);
      if (m.approved_score_run_id) {
        assessedCount += 1;
        firstAssessmentAt = min(firstAssessmentAt, m.delivered_at ?? m.created_at);
      }
      if (m.delivered_at) firstDeliveredAt = min(firstDeliveredAt, m.delivered_at);
      const stage = String(m.stage ?? "");
      if (stage === "delivered") awaitingReview += 1;
      if (stage === "shortlisted") shortlistedCount += 1;
      if (stage === "offer") offerCount += 1;
      if (stage === "hired") hires += 1;
    }

    let firstOfferAt: string | null = null;
    let firstHireAt: string | null = null;
    for (const h of (historyRes.data as Row[]) ?? []) {
      const to = String(h.to_stage ?? "");
      if (to === "offer") firstOfferAt = min(firstOfferAt, h.created_at);
      if (to === "hired") firstHireAt = min(firstHireAt, h.created_at);
    }

    const toConfirmSet = new Set<string>();
    const scheduledSet = new Set<string>();
    const completedSet = new Set<string>();
    let firstInterviewAt: string | null = null;
    let lastInterviewCompletedAt: string | null = null;
    for (const iv of interviews) {
      const status = String(iv.status ?? "");
      firstInterviewAt = min(firstInterviewAt, iv.requested_at ?? iv.created_at);
      if (status === "completed") {
        completedSet.add(iv.candidate_match_id);
        lastInterviewCompletedAt = max(lastInterviewCompletedAt, iv.completed_at);
      } else if (status === "scheduled") {
        scheduledSet.add(iv.candidate_match_id);
      } else if (["requested", "scheduling"].includes(status)) {
        toConfirmSet.add(iv.candidate_match_id);
      }
    }

    let lastDecisionAt: string | null = null;
    for (const d of decisions) lastDecisionAt = max(lastDecisionAt, d.created_at);

    const status = String(p.status ?? "");
    const signals: LifecycleSignals = {
      positionId: p.id as string,
      title: String(p.title ?? "Role"),
      status,
      statusLabel: STATUS_LABELS[status] ?? "In progress",
      createdAt: p.created_at ?? null,
      submittedAt: p.submitted_at ?? null,
      approvedAt: p.approved_at ?? null,
      clarificationRequestedAt:
        status === "needs_clarification" ? (p.updated_at ?? null) : null,
      publishedAt: p.published_at ?? null,
      closedAt: p.closed_at ?? null,
      blueprintStatus: p.blueprint_status ?? null,
      blueprintGeneratedAt: p.blueprint_generated_at ?? null,
      blueprintConfirmedAt: p.blueprint_confirmed_at ?? null,
      discoveryStartedAt,
      activeCampaigns,
      applicationCount: appsRes.count ?? 0,
      firstCandidateAt,
      candidateCount: matches.length,
      assessedCount,
      firstAssessmentAt,
      awaitingReview,
      firstDeliveredAt,
      lastDecisionAt,
      decisionCount: decisions.length,
      shortlistedCount,
      interviewsToConfirm: toConfirmSet.size,
      interviewsScheduled: scheduledSet.size,
      interviewsCompleted: completedSet.size,
      firstInterviewAt,
      lastInterviewCompletedAt,
      offerCount,
      firstOfferAt,
      hires,
      openings: Number(p.openings ?? 1),
      firstHireAt,
    };

    return computeRoleLifecycle(signals);
}

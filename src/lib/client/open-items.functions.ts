import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { isOverdue, sortOpenItems, dedupeOpenItems, type OpenItem } from "@/lib/client/open-items";
import { assertWorkspaceAccess } from "@/lib/authz/workspace-access";
import { loadKpiRows, isAwaitingClientDecision } from "@/lib/client-kpi.server";
import { buildOfferRow } from "@/lib/client-offer-holder";
import { roleGaps } from "@/lib/position-readiness";

export type BlockedRole = {
  position_id: string;
  title: string;
  reason: string;
  href: string;
};

export type OpenItemsResponse = {
  items: OpenItem[];
  blockedRoles: BlockedRole[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

/** Feedback is expected within two days of the interview taking place. */
const FEEDBACK_WINDOW_MS = 2 * 86_400_000;

export const getClientOpenItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) =>
    z.object({ orgId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<OpenItemsResponse> => {
    await assertWorkspaceAccess(context.supabase, context.userId, data.orgId);
    const s = context.supabase as AnyRow;

    // 1. Load the canonical KPI rows — the same rows used by the Overview kpis
    // and health strip. This ensures counts always reconcile.
    const kpiRows = await loadKpiRows(s, data.orgId);
    
    // 2. Fetch information requests
    const requestsRes = await s
      .from("position_info_requests")
      .select("id, position_id, question, brief_field, created_at")
      .eq("organization_id", data.orgId)
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(50);
    const requests = (requestsRes.data as AnyRow[]) ?? [];

    // 3. Fetch completed interviews missing feedback
    const interviewsRes = await s
      .from("interviews")
      .select("id, candidate_match_id, position_id, completed_at, status")
      .eq("organization_id", data.orgId)
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: true })
      .limit(100);
    const interviews = (interviewsRes.data as AnyRow[]) ?? [];

    const interviewIds = interviews.map((i) => i.id as string);
    const scored = new Set<string>();
    if (interviewIds.length > 0) {
      const { data: cards } = await s
        .from("interview_scorecards")
        .select("interview_id")
        .in("interview_id", interviewIds);
      for (const c of ((cards as AnyRow[]) ?? [])) scored.add(c.interview_id as string);
    }

    // 4. Offers: need expected response dates and holder info
    const offerMatchIds = kpiRows.filter((r) => r.stage === "offer").map((r) => r.id);
    const offerMap = new Map<string, { due: string | null; holder: string }>();
    if (offerMatchIds.length > 0) {
      const { data: offerRows } = await s
        .from("hire_records")
        .select("candidate_match_id, expected_response_date, status, drafted_at, sent_at, negotiating_at, accepted_at, declined_at, hired_at, closed_at, last_nudged_at")
        .eq("organization_id", data.orgId)
        .in("candidate_match_id", offerMatchIds);
      for (const o of (offerRows as AnyRow[]) ?? []) {
        const built = buildOfferRow(o as never);
        offerMap.set(o.candidate_match_id as string, {
          due: (o.expected_response_date as string | null) ?? null,
          holder: built.holder_label,
        });
      }
    }

    // 5. Positions: for role titles and blocked role checks
    const { data: positions } = await s
      .from("positions")
      .select("id, title, status, description, location, work_model, employment_type, seniority, requirements, compensation, intake_context")
      .eq("organization_id", data.orgId)
      .in("status", ["active", "approved", "needs_clarification"]);
    
    const titles = new Map<string, string>();
    const blockedRoles: BlockedRole[] = [];
    for (const p of (positions as AnyRow[]) ?? []) {
      titles.set(p.id, p.title);
      
      const comp = (p.compensation ?? {}) as AnyRow;
      const ctx = (p.intake_context ?? {}) as AnyRow;
      const gaps = roleGaps({
        title: p.title,
        description: p.description,
        location: p.location,
        work_model: p.work_model,
        employment_type: p.employment_type,
        seniority: p.seniority,
        must_have_skills: Array.isArray(p.requirements) ? p.requirements : [],
        experience: typeof ctx.experience === "string" ? ctx.experience : "",
        responsibilities: typeof ctx.responsibilities === "string" ? ctx.responsibilities : "",
        budget_min: comp.budget_min ?? null,
        budget_max: comp.budget_max ?? null,
        currency: comp.currency ?? null,
      });

      const isBlocked = p.status === "needs_clarification" || gaps.length > 0;
      if (isBlocked) {
        blockedRoles.push({
          position_id: p.id,
          title: p.title,
          reason: p.status === "needs_clarification" ? "Needs clarification" : "Needs intake",
          href: `/client/positions/${p.id}`,
        });
      }
    }

    const roleLine = (pid: string | null) => (pid ? (titles.get(pid) ?? "Your role") : null);
    const now = Date.now();
    const items: OpenItem[] = [];

    // Information requests
    for (const r of requests) {
      items.push({
        kind: "info_request",
        id: r.id,
        label: r.question as string,
        context: roleLine(r.position_id),
        href: r.position_id ? `/client/positions/${r.position_id}#information-needed` : "/client",
        due_at: null,
        overdue: false,
        waiting_since: r.created_at,
      });
    }

    // Decisions (Delivered matches)
    for (const r of kpiRows) {
      if (!isAwaitingClientDecision(r)) continue;
      const due = r.client_decision_due_at;
      items.push({
        kind: "pending_decision",
        id: r.id,
        subject_id: r.id,
        label: "A candidate is waiting on your decision",
        context: roleLine(r.position_id),
        href: `/client/candidates/${r.id}`,
        due_at: due,
        overdue: isOverdue(due, now),
        waiting_since: r.delivered_at ?? r.stage_entered_at,
      });
    }

    // Missing Feedback
    for (const i of interviews) {
      if (scored.has(i.id)) continue;
      const completed = i.completed_at as string | null;
      const due = completed
        ? new Date(new Date(completed).getTime() + FEEDBACK_WINDOW_MS).toISOString()
        : null;
      items.push({
        kind: "missing_feedback",
        id: i.id,
        subject_id: i.candidate_match_id,
        label: "Give interview feedback",
        context: roleLine(i.position_id),
        href: `/client/candidates/${i.candidate_match_id}`,
        due_at: due,
        overdue: isOverdue(due, now),
        waiting_since: completed,
      });
    }

    // Offers
    for (const r of kpiRows) {
      if (r.stage !== "offer") continue;
      const offer = offerMap.get(r.id);
      const due = offer?.due ?? r.client_decision_due_at;
      items.push({
        kind: "offer",
        id: r.id,
        subject_id: r.id,
        label: offer ? `Offer — waiting on ${offer.holder}` : "Offer awaiting response",
        context: roleLine(r.position_id),
        href: "/client/offers",
        due_at: due,
        overdue: isOverdue(due, now),
        waiting_since: r.stage_entered_at,
      });
    }

    // Interviews to confirm
    for (const r of kpiRows) {
      if (!r.interview_needs_confirmation) continue;
      const due = r.next_interview_at;
      items.push({
        kind: "interview",
        id: r.id,
        subject_id: r.id,
        label: "Confirm an interview time",

        context: roleLine(r.position_id),
        href: r.interview_id ? `/client/interviews?interview=${r.interview_id}` : "/client/interviews",
        due_at: due,
        overdue: isOverdue(due, now),
        waiting_since: r.interview_requested_at ?? r.stage_entered_at,
      });
    }

    return { 
      items: sortOpenItems(dedupeOpenItems(items)),
      blockedRoles,
    };
  });

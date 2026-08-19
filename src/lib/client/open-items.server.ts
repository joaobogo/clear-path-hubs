import { excludeTestRecords } from "@/lib/client/test-record-filter";
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

const FEEDBACK_WINDOW_MS = 2 * 86_400_000;

export async function loadClientOpenItems(
  supabase: AnyRow,
  userId: string,
  orgId: string,
): Promise<OpenItemsResponse> {
  await assertWorkspaceAccess(supabase, userId, orgId);
  const kpiRows = await loadKpiRows(supabase, orgId);

  const requestsRes = await supabase
    .from("position_info_requests")
    .select("id, position_id, question, brief_field, created_at")
    .eq("organization_id", orgId)
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(50);
  const requests = (requestsRes.data as AnyRow[]) ?? [];

  const interviewsRes = await supabase
    .from("interviews")
    .select("id, candidate_match_id, position_id, completed_at, status")
    .eq("organization_id", orgId)
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: true })
    .limit(100);
  const interviews = (interviewsRes.data as AnyRow[]) ?? [];

  const interviewIds = interviews.map((interview) => interview.id as string);
  const scored = new Set<string>();
  if (interviewIds.length > 0) {
    const { data: cards } = await supabase
      .from("interview_scorecards")
      .select("interview_id")
      .in("interview_id", interviewIds);
    for (const card of (cards as AnyRow[]) ?? []) scored.add(card.interview_id as string);
  }

  const offerMatchIds = kpiRows.filter((row) => row.stage === "offer").map((row) => row.id);
  const offerMap = new Map<string, { due: string | null; holder: string }>();
  if (offerMatchIds.length > 0) {
    const { data: offerRows } = await supabase
      .from("hire_records")
      .select("candidate_match_id, expected_response_date, status, drafted_at, sent_at, negotiating_at, accepted_at, declined_at, hired_at, closed_at, last_nudged_at")
      .eq("organization_id", orgId)
      .in("candidate_match_id", offerMatchIds);
    for (const offer of (offerRows as AnyRow[]) ?? []) {
      const built = buildOfferRow(offer as never);
      offerMap.set(offer.candidate_match_id as string, {
        due: (offer.expected_response_date as string | null) ?? null,
        holder: built.holder_label,
      });
    }
  }

  const { data: positions } = await excludeTestRecords(
    supabase
      .from("positions")
      .select("id, title, status, description, location, work_model, employment_type, seniority, requirements, compensation, intake_context")
      .eq("organization_id", orgId)
      .in("status", ["active", "approved", "needs_clarification"]),
  );

  const titles = new Map<string, string>();
  const blockedRoles: BlockedRole[] = [];
  for (const position of (positions as AnyRow[]) ?? []) {
    titles.set(position.id, position.title);
    const compensation = (position.compensation ?? {}) as AnyRow;
    const intake = (position.intake_context ?? {}) as AnyRow;
    const gaps = roleGaps({
      title: position.title,
      description: position.description,
      location: position.location,
      work_model: position.work_model,
      employment_type: position.employment_type,
      seniority: position.seniority,
      must_have_skills: Array.isArray(position.requirements) ? position.requirements : [],
      experience: typeof intake.experience === "string" ? intake.experience : "",
      responsibilities: typeof intake.responsibilities === "string" ? intake.responsibilities : "",
      budget_min: compensation.budget_min ?? null,
      budget_max: compensation.budget_max ?? null,
      currency: compensation.currency ?? null,
    });
    if (position.status === "needs_clarification" || gaps.length > 0) {
      blockedRoles.push({
        position_id: position.id,
        title: position.title,
        reason: position.status === "needs_clarification" ? "Needs clarification" : "Needs intake",
        href: `/client/positions/${position.id}`,
      });
    }
  }

  const roleLine = (positionId: string | null) =>
    positionId ? (titles.get(positionId) ?? "Your role") : null;
  const now = Date.now();
  const items: OpenItem[] = [];

  for (const request of requests) {
    items.push({
      kind: "info_request",
      id: request.id,
      label: request.question as string,
      context: roleLine(request.position_id),
      href: request.position_id ? `/client/positions/${request.position_id}#information-needed` : "/client",
      due_at: null,
      overdue: false,
      waiting_since: request.created_at,
    });
  }

  for (const row of kpiRows) {
    if (!isAwaitingClientDecision(row)) continue;
    items.push({
      kind: "pending_decision",
      id: row.id,
      subject_id: row.id,
      label: "A candidate is waiting on your decision",
      context: roleLine(row.position_id),
      href: `/client/candidates/${row.id}`,
      due_at: row.client_decision_due_at,
      overdue: isOverdue(row.client_decision_due_at, now),
      waiting_since: row.delivered_at ?? row.stage_entered_at,
    });
  }

  for (const interview of interviews) {
    if (scored.has(interview.id)) continue;
    const completed = interview.completed_at as string | null;
    const due = completed
      ? new Date(new Date(completed).getTime() + FEEDBACK_WINDOW_MS).toISOString()
      : null;
    items.push({
      kind: "missing_feedback",
      id: interview.id,
      subject_id: interview.candidate_match_id,
      label: "Give interview feedback",
      context: roleLine(interview.position_id),
      href: `/client/candidates/${interview.candidate_match_id}`,
      due_at: due,
      overdue: isOverdue(due, now),
      waiting_since: completed,
    });
  }

  for (const row of kpiRows) {
    if (row.stage !== "offer") continue;
    const offer = offerMap.get(row.id);
    const due = offer?.due ?? row.client_decision_due_at;
    items.push({
      kind: "offer",
      id: row.id,
      subject_id: row.id,
      label: offer ? `Offer — waiting on ${offer.holder}` : "Offer awaiting response",
      context: roleLine(row.position_id),
      href: "/client/offers",
      due_at: due,
      overdue: isOverdue(due, now),
      waiting_since: row.stage_entered_at,
    });
  }

  for (const row of kpiRows) {
    if (!row.interview_needs_confirmation) continue;
    items.push({
      kind: "interview",
      id: row.id,
      subject_id: row.id,
      label: "Confirm an interview time",
      context: roleLine(row.position_id),
      href: row.interview_id ? `/client/interviews?interview=${row.interview_id}` : "/client/interviews",
      due_at: row.next_interview_at,
      overdue: isOverdue(row.next_interview_at, now),
      waiting_since: row.interview_requested_at ?? row.stage_entered_at,
    });
  }

  return { items: sortOpenItems(dedupeOpenItems(items)), blockedRoles };
}
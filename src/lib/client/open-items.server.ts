import { excludeTestRecords } from "@/lib/client/test-record-filter";
import { isOverdue, sortOpenItems, dedupeOpenItems, type OpenItem } from "@/lib/client/open-items";
import { assertWorkspaceAccess } from "@/lib/authz/workspace-access";
import { loadKpiRows, isAwaitingClientDecision } from "@/lib/client-kpi.server";
import { buildOfferRow } from "@/lib/client-offer-holder";
import { stageEnteredAt } from "@/lib/offer-stall";

import { roleGaps } from "@/lib/position-readiness";
import { loadInterviewsAwaitingConfirmation } from "@/lib/client/interviews-to-confirm.server";

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
  const offerMap = new Map<string, { due: string | null; holder: string; movedAt: string | null }>();
  if (offerMatchIds.length > 0) {
    const { data: offerRows } = await supabase
      .from("hire_records")
      .select("candidate_match_id, expected_response_date, status, drafted_at, sent_at, negotiating_at, accepted_at, declined_at, hired_at, closed_at, last_nudged_at")
      .eq("organization_id", orgId)
      .in("candidate_match_id", offerMatchIds);
    for (const offer of (offerRows as AnyRow[]) ?? []) {
      const built = buildOfferRow(offer as never);
      // The queue ages the offer from the same movement mark the Offers page
      // reads (stage entry, or the last nudge if that is more recent), so both
      // surfaces quote the same number of days.
      const entered = stageEnteredAt(offer as never);
      const marks = [entered, offer.last_nudged_at as string | null]
        .filter((t): t is string => Boolean(t) && !Number.isNaN(Date.parse(t as string)))
        .sort();
      offerMap.set(offer.candidate_match_id as string, {
        due: (offer.expected_response_date as string | null) ?? null,
        holder: built.holder_label,
        movedAt: marks.length > 0 ? marks[marks.length - 1] : null,
      });
    }
  }

  // Interviews that still need a time come from the one shared query the Roles
  // banner uses.
  const pendingConfirmations = await loadInterviewsAwaitingConfirmation(supabase, orgId);

  // Candidate names for the rows that act on one person, so interview and offer
  // rows read like the feedback rows ("… for Carla Nunes").
  const namedMatchIds = [
    ...offerMatchIds,
    ...pendingConfirmations.map((p) => p.candidate_match_id),
  ].filter(Boolean);
  const matchNames = new Map<string, string>();
  if (namedMatchIds.length > 0) {
    const { data: matchRows } = await supabase
      .from("candidate_matches")
      .select("id, candidate_profiles(full_name)")
      .eq("organization_id", orgId)
      .in("id", Array.from(new Set(namedMatchIds)));
    for (const row of (matchRows as AnyRow[]) ?? []) {
      const profile = Array.isArray(row.candidate_profiles)
        ? row.candidate_profiles[0]
        : row.candidate_profiles;
      const name = String(profile?.full_name ?? "").trim();
      if (name) matchNames.set(row.id as string, name);
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
      // Named, scored rows: five identical "A candidate is waiting…" lines
      // told the client nothing but the wait times (audit #3, finding 17).
      label: row.candidate_name
        ? `${row.candidate_name}${row.approved_score != null ? ` (${Math.round(row.approved_score)})` : ""} is waiting on your decision`
        : "A candidate is waiting on your decision",
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
    const name = matchNames.get(row.id);
    const holder = offer ? `waiting on ${offer.holder}` : "awaiting response";
    items.push({
      kind: "offer",
      id: row.id,
      subject_id: row.id,
      label: name ? `Offer for ${name} — ${holder}` : `Offer — ${holder}`,
      context: roleLine(row.position_id),
      href: "/client/offers",
      due_at: due,
      overdue: isOverdue(due, now),
      waiting_since: offer?.movedAt ?? row.stage_entered_at,
    });
  }

  // The subject key is namespaced so an offer or decision on the same candidate
  // can never collapse this row away and shrink the count.
  for (const pending of pendingConfirmations) {
    const name = matchNames.get(pending.candidate_match_id);
    items.push({
      kind: "interview",
      id: pending.interview_id,
      subject_id: `interview:${pending.candidate_match_id}`,
      label: name ? `Confirm an interview time for ${name}` : "Confirm an interview time",
      context: roleLine(pending.position_id),
      href: `/client/interviews?interview=${pending.interview_id}`,
      due_at: null,
      overdue: false,
      waiting_since: pending.requested_at,
    });
  }


  return { items: sortOpenItems(dedupeOpenItems(items)), blockedRoles };
}
/**
 * Loads the terminal-outcome breach queue: every application that is either
 * past our review commitment with no outcome, or decided without the candidate
 * ever being told.
 *
 * Staff-only. Reads with the service client because it deliberately crosses
 * every tenant — this is our own promise being audited, not a client view.
 */

import { assessOutcome, BREACH_STATES, type OutcomeAssessment } from "./outcome-sla";

export interface OutcomeBreachRow {
  application_id: string;
  reference: string;
  candidate_name: string | null;
  candidate_email: string | null;
  position_id: string | null;
  position_title: string | null;
  organization_name: string | null;
  match_id: string | null;
  applied_at: string;
  application_status: string;
  match_stage: string | null;
  is_test_record: boolean;
  assessment: OutcomeAssessment;
}

export interface OutcomeBreachSummary {
  rows: OutcomeBreachRow[];
  counts: { outcome_not_sent: number; overdue: number };
  considered: number;
  /** True when the underlying read failed, so the UI never shows "all clear" on an error. */
  failed: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export async function loadOutcomeBreaches(
  db: Db,
  opts: { includeTest?: boolean; limit?: number } = {},
): Promise<OutcomeBreachSummary> {
  const limit = opts.limit ?? 400;
  const empty: OutcomeBreachSummary = {
    rows: [],
    counts: { outcome_not_sent: 0, overdue: 0 },
    considered: 0,
    failed: false,
  };

  let query = db
    .from("applications")
    .select(
      `id, status, applied_at, created_at, withdrawn_at, closure_notified_at, is_test_record,
       position_id,
       candidate_profiles ( full_name, email ),
       positions ( id, title, organizations ( name ) ),
       candidate_matches ( id, stage )`,
    )
    .order("created_at", { ascending: true })
    .limit(limit);

  if (!opts.includeTest) query = query.eq("is_test_record", false);

  const { data, error } = await query;
  if (error) {
    console.error("[outcome-sla] query failed", error.message);
    return { ...empty, failed: true };
  }

  const now = new Date();
  const rows: OutcomeBreachRow[] = [];
  for (const app of (data ?? []) as Db[]) {
    const match = Array.isArray(app.candidate_matches) ? app.candidate_matches[0] : app.candidate_matches;
    const assessment = assessOutcome({
      applicationStatus: String(app.status),
      matchStage: (match?.stage as string | null) ?? null,
      withdrawnAt: app.withdrawn_at ?? null,
      closureNotifiedAt: app.closure_notified_at ?? null,
      appliedAt: String(app.applied_at ?? app.created_at),
      now,
    });
    if (!BREACH_STATES.includes(assessment.state)) continue;

    rows.push({
      application_id: String(app.id),
      reference: String(app.id).replace(/-/g, "").slice(0, 6).toUpperCase(),
      candidate_name: app.candidate_profiles?.full_name ?? null,
      candidate_email: app.candidate_profiles?.email ?? null,
      position_id: app.positions?.id ?? app.position_id ?? null,
      position_title: app.positions?.title ?? null,
      organization_name: app.positions?.organizations?.name ?? null,
      match_id: (match?.id as string | null) ?? null,
      applied_at: String(app.applied_at ?? app.created_at),
      application_status: String(app.status),
      match_stage: (match?.stage as string | null) ?? null,
      is_test_record: Boolean(app.is_test_record),
      assessment,
    });
  }

  rows.sort((a, b) => b.assessment.weight - a.assessment.weight);

  return {
    rows,
    counts: {
      outcome_not_sent: rows.filter((r) => r.assessment.state === "outcome_not_sent").length,
      overdue: rows.filter((r) => r.assessment.state === "overdue").length,
    },
    considered: (data ?? []).length,
    failed: false,
  };
}

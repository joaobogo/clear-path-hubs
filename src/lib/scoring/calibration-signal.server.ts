/**
 * Loads the rows `computeCalibrationSignal` needs: every completed score run
 * joined to whatever downstream outcome the candidate reached, with test
 * records excluded via the standard admin test-scope helper.
 *
 * Outcome precedence (best evidence first):
 *   1. hire_records.status  — a real hire process exists (offer/hire/close).
 *   2. client_decisions.decision — the client acted on the candidate.
 *   3. candidate_matches.stage — no explicit decision row, fall back to stage.
 * A candidate still sitting in an early stage with no decision and no hire
 * record is "no_decision" — excluded from the outcome-count denominator, not
 * counted as a rejection.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

import { computeCalibrationSignal, type CalibrationOutcome, type CalibrationRow, type CalibrationSignal } from "./calibration-signal";

function outcomeFromHireStatus(status: string | null): CalibrationOutcome | null {
  switch (status) {
    case "hire_confirmed":
      return "hired";
    case "offer_sent":
    case "offer_negotiating":
    case "offer_accepted":
    case "offer_drafted":
      return "offered";
    case "closed_lost":
      return "rejected";
    default:
      return null;
  }
}

function outcomeFromDecision(decision: string | null): CalibrationOutcome | null {
  switch (decision) {
    case "hire":
      return "hired";
    case "offer":
      return "offered";
    case "request_interview":
      return "interviewed";
    case "shortlist":
      return "advanced";
    case "not_moving_forward":
      return "rejected";
    default:
      return null;
  }
}

function outcomeFromStage(stage: string | null): CalibrationOutcome {
  switch (stage) {
    case "hired":
      return "hired";
    case "offer":
      return "offered";
    case "interview_process":
      return "interviewed";
    case "shortlisted":
      return "advanced";
    case "not_moving_forward":
      return "rejected";
    default:
      return "no_decision";
  }
}

/**
 * Loads completed score runs (one per candidate_match: the most recently
 * completed run), resolves each to an outcome, and returns the computed
 * calibration signal. `includeTest` mirrors every other admin surface's
 * test-record toggle.
 */
export async function loadCalibrationSignal(
  supabaseAdmin: Any,
  opts: { includeTest?: boolean } = {},
): Promise<CalibrationSignal> {
  const { loadTestScope, excludeTestOrgs } = await import("@/lib/admin-test-scope.server");
  const scope = await loadTestScope(supabaseAdmin, opts.includeTest ?? false);

  let runsQuery = supabaseAdmin
    .from("score_runs")
    .select("id,candidate_match_id,final_score,fit_band,completed_at,organization_id,is_test_record")
    .eq("status", "completed")
    .not("final_score", "is", null)
    .order("candidate_match_id", { ascending: true })
    .order("completed_at", { ascending: false })
    .limit(5000);
  runsQuery = excludeTestOrgs(runsQuery, scope);
  if (!scope.includeTest) {
    runsQuery = runsQuery.or("is_test_record.is.null,is_test_record.eq.false");
  }

  const { data: runs, error: runsError } = await runsQuery;
  if (runsError) throw runsError;

  const latestByMatch = new Map<string, Any>();
  for (const run of (runs ?? []) as Any[]) {
    if (!latestByMatch.has(run.candidate_match_id)) {
      latestByMatch.set(run.candidate_match_id, run);
    }
  }
  const matchIds = [...latestByMatch.keys()];
  if (matchIds.length === 0) return computeCalibrationSignal([]);

  const [{ data: matches, error: matchesError }, { data: decisions, error: decisionsError }, { data: hires, error: hiresError }] =
    await Promise.all([
      supabaseAdmin.from("candidate_matches").select("id,stage").in("id", matchIds),
      supabaseAdmin
        .from("client_decisions")
        .select("candidate_match_id,decision,created_at")
        .in("candidate_match_id", matchIds)
        .is("reversed_at", null)
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("hire_records").select("candidate_match_id,status").in("candidate_match_id", matchIds),
    ]);
  if (matchesError) throw matchesError;
  if (decisionsError) throw decisionsError;
  if (hiresError) throw hiresError;

  const stageByMatch = new Map<string, string | null>(
    ((matches ?? []) as Any[]).map((m) => [m.id as string, (m.stage as string) ?? null]),
  );
  const latestDecisionByMatch = new Map<string, string | null>();
  for (const d of (decisions ?? []) as Any[]) {
    if (!latestDecisionByMatch.has(d.candidate_match_id)) {
      latestDecisionByMatch.set(d.candidate_match_id, (d.decision as string) ?? null);
    }
  }
  const hireStatusByMatch = new Map<string, string | null>(
    ((hires ?? []) as Any[]).map((h) => [h.candidate_match_id as string, (h.status as string) ?? null]),
  );

  const rows: CalibrationRow[] = matchIds.map((matchId) => {
    const run = latestByMatch.get(matchId);
    const outcome =
      outcomeFromHireStatus(hireStatusByMatch.get(matchId) ?? null) ??
      outcomeFromDecision(latestDecisionByMatch.get(matchId) ?? null) ??
      outcomeFromStage(stageByMatch.get(matchId) ?? null);
    return {
      final_score: Number(run.final_score),
      fit_band: (run.fit_band as string) ?? null,
      outcome,
    };
  });

  return computeCalibrationSignal(rows);
}

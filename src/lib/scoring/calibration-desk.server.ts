/**
 * Row loading for the calibration desk (Wave 4, prompt 12).
 *
 * One row per candidate_match with a completed score run, joined to what
 * actually happened: the client's latest live decision, whether an interview
 * was actually held (`interviews.status = 'completed'`, not merely requested),
 * the hire record, and the structured reason on any decline.
 *
 * Test organisations and test-flagged positions/runs are removed through the
 * centralised `admin-test-scope.server` helper, inside Postgres, so every
 * figure on the desk shares one denominator.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

import { computeCalibrationDesk, type CalibrationDesk, type DeskRow } from "./calibration-desk";

const APPROVAL_DECISIONS = new Set(["shortlist", "request_interview", "offer", "hire"]);
const DECLINE_DECISIONS = new Set(["not_moving_forward"]);
const OFFER_HIRE_STATUSES = new Set([
  "offer_drafted",
  "offer_sent",
  "offer_negotiating",
  "offer_accepted",
  "hire_confirmed",
]);
const ADVANCED_STAGES = new Set(["shortlisted", "interview_process", "offer", "hired"]);

export async function loadCalibrationDesk(
  supabaseAdmin: Any,
  opts: { includeTest?: boolean } = {},
): Promise<CalibrationDesk> {
  const { loadTestScope, excludeTestOrgs } = await import("@/lib/admin-test-scope.server");
  const scope = await loadTestScope(supabaseAdmin, opts.includeTest ?? false);

  let runsQuery = supabaseAdmin
    .from("score_runs")
    .select("candidate_match_id,final_score,completed_at,organization_id,is_test_record")
    .eq("status", "completed")
    .not("final_score", "is", null)
    .not("candidate_match_id", "is", null)
    .order("candidate_match_id", { ascending: true })
    .order("completed_at", { ascending: false })
    .limit(5000);
  runsQuery = excludeTestOrgs(runsQuery, scope);
  if (!scope.includeTest) {
    runsQuery = runsQuery.or("is_test_record.is.null,is_test_record.eq.false");
  }

  const { data: runs, error: runsError } = await runsQuery;
  if (runsError) throw runsError;

  // Most recent completed run wins — one row per candidate, never per attempt.
  const latestByMatch = new Map<string, Any>();
  for (const run of (runs ?? []) as Any[]) {
    if (!latestByMatch.has(run.candidate_match_id)) latestByMatch.set(run.candidate_match_id, run);
  }
  const matchIds = [...latestByMatch.keys()];
  if (!matchIds.length) return computeCalibrationDesk([]);

  const [matches, decisions, hires, interviews] = await Promise.all([
    supabaseAdmin.from("candidate_matches").select("id,stage,position_id").in("id", matchIds),
    supabaseAdmin
      .from("client_decisions")
      .select("candidate_match_id,decision,reason_code,created_at")
      .in("candidate_match_id", matchIds)
      .is("reversed_at", null)
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("hire_records").select("candidate_match_id,status").in("candidate_match_id", matchIds),
    supabaseAdmin
      .from("interviews")
      .select("candidate_match_id,status")
      .in("candidate_match_id", matchIds)
      .eq("status", "completed"),
  ]);
  for (const res of [matches, decisions, hires, interviews]) {
    if (res.error) throw res.error;
  }

  const matchRows = (matches.data ?? []) as Any[];
  const positionIds = [
    ...new Set(matchRows.map((m) => m.position_id as string | null).filter(Boolean) as string[]),
  ];

  // role_family is computed by the database (role_family_of(title)) and exposed
  // on this view, so the desk groups by exactly the same families as every
  // other operations report instead of re-deriving them in TypeScript.
  const { data: positionMeta, error: positionError } = positionIds.length
    ? await supabaseAdmin
        .from("v_position_time_to_submission")
        .select("position_id,position_title,role_family")
        .in("position_id", positionIds)
    : { data: [], error: null };
  if (positionError) throw positionError;

  const metaByPosition = new Map<string, { title: string | null; family: string | null }>(
    ((positionMeta ?? []) as Any[]).map((p) => [
      p.position_id as string,
      { title: (p.position_title as string) ?? null, family: (p.role_family as string) ?? null },
    ]),
  );

  const matchById = new Map<string, Any>(matchRows.map((m) => [m.id as string, m]));

  const latestDecision = new Map<string, Any>();
  const anyApproval = new Set<string>();
  for (const d of (decisions.data ?? []) as Any[]) {
    if (!latestDecision.has(d.candidate_match_id)) latestDecision.set(d.candidate_match_id, d);
    if (APPROVAL_DECISIONS.has(String(d.decision))) anyApproval.add(d.candidate_match_id as string);
  }

  const hireStatus = new Map<string, string | null>(
    ((hires.data ?? []) as Any[]).map((h) => [h.candidate_match_id as string, (h.status as string) ?? null]),
  );
  const held = new Set<string>(
    ((interviews.data ?? []) as Any[]).map((i) => i.candidate_match_id as string),
  );

  const rows: DeskRow[] = matchIds.map((matchId) => {
    const run = latestByMatch.get(matchId);
    const match = matchById.get(matchId);
    const positionId = (match?.position_id as string | null) ?? null;
    const meta = positionId ? metaByPosition.get(positionId) : undefined;
    const decision = latestDecision.get(matchId);
    const stage = (match?.stage as string | null) ?? null;
    const hire = hireStatus.get(matchId) ?? null;

    const declined = DECLINE_DECISIONS.has(String(decision?.decision)) || stage === "not_moving_forward";
    const approved =
      anyApproval.has(matchId) || (stage ? ADVANCED_STAGES.has(stage) : false) || Boolean(hire);
    const offered =
      (hire ? OFFER_HIRE_STATUSES.has(hire) : false) ||
      stage === "offer" ||
      stage === "hired" ||
      String(decision?.decision) === "offer";
    const hired = hire === "hire_confirmed" || stage === "hired";

    return {
      match_id: matchId,
      final_score: Number(run.final_score),
      position_id: positionId,
      position_title: meta?.title ?? null,
      role_family: meta?.family ?? null,
      approved: approved && !declined ? true : approved,
      interview_held: held.has(matchId),
      offered,
      hired,
      declined,
      decline_reason_code: declined ? ((decision?.reason_code as string) ?? null) : null,
    };
  });

  return computeCalibrationDesk(rows);
}

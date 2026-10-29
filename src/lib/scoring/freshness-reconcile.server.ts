/**
 * Nightly score-freshness reconciliation — Prompt 9.
 *
 * Database triggers mark a match stale the moment its inputs move (role
 * requirements, screening questions, rubric version, a newer CV). This job is
 * the other half: it turns those flags into queued rescores, so a stale score
 * never sits stale forever waiting for a human to notice.
 *
 * Deliberate properties:
 *  - batch cap: a bad day of edits cannot enqueue the whole database
 *  - one audit event per queued job: the queue is explainable after the fact
 *  - idempotent: a match already queued in the cooldown window is skipped
 *  - never rewrites the visible score: it only queues work
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
/** A match queued more recently than this is left alone. */
const REQUEUE_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export type ReconcileOutcome = {
  scanned: number;
  queued: number;
  skipped: number;
  limit: number;
  trace_id: string;
  matches: { match_id: string; reasons: string[] }[];
};

function newTraceId() {
  return `fresh_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export async function reconcileScoreFreshness(
  opts: { limit?: number; dryRun?: boolean } = {},
): Promise<ReconcileOutcome> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const s = supabaseAdmin as Any;
  const limit = Math.min(Math.max(opts.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const trace_id = newTraceId();
  const cooldownBefore = new Date(Date.now() - REQUEUE_COOLDOWN_MS).toISOString();

  const { data: rows, error } = await s
    .from("candidate_matches")
    .select(
      "id,organization_id,position_id,score_stale,score_stale_reasons,score_stale_at,rescore_queued_at,processing_state,is_test_record",
    )
    .eq("score_stale", true)
    .not("current_score_run_id", "is", null)
    .or(`rescore_queued_at.is.null,rescore_queued_at.lt.${cooldownBefore}`)
    .order("score_stale_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`freshness_scan_failed:${error.message}`);

  const candidates = (rows ?? []) as Any[];
  const queued: { match_id: string; reasons: string[] }[] = [];
  let skipped = 0;

  for (const row of candidates) {
    // A match already mid-flight is left to finish; re-queuing would only churn.
    if (["parsing", "enriching", "scoring", "ready_to_score"].includes(String(row.processing_state))) {
      skipped += 1;
      continue;
    }
    const reasons: string[] = Array.isArray(row.score_stale_reasons) ? row.score_stale_reasons : [];
    if (opts.dryRun) {
      queued.push({ match_id: row.id, reasons });
      continue;
    }

    const now = new Date().toISOString();
    try {
      // No processing_jobs row here — deliberately.
      //
      // The queue a rescore is actually drained from is
      // candidate_matches.processing_state: drainQueue step 2 selects
      // `ready_to_score` rows every two minutes, so the update below IS the
      // enqueue. A processing_jobs{job_type:'rescore'} row had no consumer at
      // all — drainApplicationJobs claims only parse_and_score/application —
      // so reapUnconsumableJobs cancelled every one of them as `no_worker`
      // thirty minutes later. The ledger reported a nightly batch of dead jobs
      // for work that had in fact run (TF-A-025). The audit event below stays
      // the durable record of what was queued and why.
      await s
        .from("candidate_matches")
        .update({ rescore_queued_at: now, processing_state: "ready_to_score" })
        .eq("id", row.id);
      // One audit event per queued job — the queue must be reconstructable.
      await s.from("audit_events").insert({
        organization_id: row.organization_id ?? null,
        entity_type: "candidate_match",
        entity_id: row.id,
        action: "scoring.rescore_queued",
        after_state: {
          reasons,
          stale_since: row.score_stale_at ?? null,
          queued_by: "freshness_reconciliation",
          position_id: row.position_id ?? null,
        },
        trace_id,
      });
      queued.push({ match_id: row.id, reasons });
    } catch (err) {
      console.error("[freshness-reconcile] queue failed", row.id, (err as Error)?.message);
      skipped += 1;
    }
  }

  return {
    scanned: candidates.length,
    queued: queued.length,
    skipped,
    limit,
    trace_id,
    matches: queued,
  };
}

/**
 * Called after a successful scoring run: the visible score now describes the
 * current facts, so the staleness record is cleared.
 */
export async function clearScoreStaleness(matchId: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as Any)
      .from("candidate_matches")
      .update({
        score_stale: false,
        score_stale_reasons: [],
        score_stale_at: null,
        rescore_queued_at: null,
      })
      .eq("id", matchId);
  } catch (err) {
    console.error("[freshness] clear failed", matchId, (err as Error)?.message);
  }
}

/**
 * Scoring guardrail health check, run with the nightly reconciliation and
 * read by the admin data-health page. Reads only; the flagging rules live in
 * scoring/guardrail-health.ts.
 */
export async function scanScoringGuardrails(
  opts: { includeTest?: boolean } = {},
): Promise<import("./guardrail-health").GuardrailReport & { generated_at: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { flagGuardrails } = await import("./guardrail-health");
  const { ENGINE_VERSION } = await import("./engine-version");
  const s = supabaseAdmin as Any;
  const LIMIT = 20000;

  let mq = s
    .from("candidate_matches")
    .select("id,position_id,eligibility_status,current_score_run_id,processing_state,created_at,is_test_record")
    .limit(LIMIT);
  if (!opts.includeTest) mq = mq.eq("is_test_record", false);
  const [matchesRes, checksRes, tasksRes, positionsRes] = await Promise.all([
    mq,
    s.from("eligibility_checks").select("candidate_match_id").eq("status", "failed").limit(LIMIT),
    s
      .from("tasks")
      .select("candidate_match_id")
      .in("status", ["open", "in_progress"])
      .is("deleted_at", null)
      .not("candidate_match_id", "is", null)
      .limit(LIMIT),
    s
      .from("positions")
      .select("id,title,status,requirements,preferred_requirements,dealbreakers")
      .not("status", "in", "(filled,closed,archived)")
      .limit(5000),
  ]);
  for (const r of [matchesRes, checksRes, tasksRes, positionsRes]) {
    if (r.error) throw new Error(`guardrail_scan_failed:${r.error.message}`);
  }
  const matches = (matchesRes.data ?? []) as Any[];
  const positions = (positionsRes.data ?? []) as Any[];

  const positionIds = positions.map((p) => p.id as string);
  const questions: Any[] = [];
  for (let i = 0; i < positionIds.length; i += 200) {
    const { data } = await s
      .from("screening_questions")
      .select("position_id,question")
      .in("position_id", positionIds.slice(i, i + 200));
    questions.push(...((data ?? []) as Any[]));
  }

  const runIds = [...new Set(matches.map((m) => m.current_score_run_id).filter(Boolean))] as string[];
  const runEngine = new Map<string, string | null>();
  for (let i = 0; i < runIds.length; i += 200) {
    const { data } = await s.from("score_runs").select("id,engine_version").in("id", runIds.slice(i, i + 200));
    for (const r of (data ?? []) as Any[]) runEngine.set(r.id, r.engine_version ?? null);
  }
  const currentRunEngine = new Map<string, string | null>(
    matches
      .filter((m) => m.current_score_run_id)
      .map((m) => [m.id as string, runEngine.get(m.current_score_run_id) ?? null]),
  );

  const report = flagGuardrails({
    now: new Date(),
    engineVersion: ENGINE_VERSION,
    matches,
    failedCheckMatchIds: new Set(((checksRes.data ?? []) as Any[]).map((c) => c.candidate_match_id)),
    openTaskMatchIds: new Set(((tasksRes.data ?? []) as Any[]).map((t) => t.candidate_match_id)),
    positions,
    screeningQuestions: questions,
    currentRunEngine,
  });
  return { ...report, generated_at: new Date().toISOString() };
}

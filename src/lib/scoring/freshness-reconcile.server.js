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
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
/** A match queued more recently than this is left alone. */
const REQUEUE_COOLDOWN_MS = 6 * 60 * 60 * 1000;
function newTraceId() {
    return `fresh_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}
export async function reconcileScoreFreshness(opts = {}) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = supabaseAdmin;
    const limit = Math.min(Math.max(opts.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const trace_id = newTraceId();
    const cooldownBefore = new Date(Date.now() - REQUEUE_COOLDOWN_MS).toISOString();
    const { data: rows, error } = await s
        .from("candidate_matches")
        .select("id,organization_id,position_id,score_stale,score_stale_reasons,score_stale_at,rescore_queued_at,processing_state,is_test_record")
        .eq("score_stale", true)
        .not("current_score_run_id", "is", null)
        .or(`rescore_queued_at.is.null,rescore_queued_at.lt.${cooldownBefore}`)
        .order("score_stale_at", { ascending: true })
        .limit(limit);
    if (error)
        throw new Error(`freshness_scan_failed:${error.message}`);
    const candidates = (rows ?? []);
    const queued = [];
    let skipped = 0;
    for (const row of candidates) {
        // A match already mid-flight is left to finish; re-queuing would only churn.
        if (["parsing", "enriching", "scoring", "ready_to_score"].includes(String(row.processing_state))) {
            skipped += 1;
            continue;
        }
        const reasons = Array.isArray(row.score_stale_reasons) ? row.score_stale_reasons : [];
        if (opts.dryRun) {
            queued.push({ match_id: row.id, reasons });
            continue;
        }
        const now = new Date().toISOString();
        try {
            await s.from("processing_jobs").insert({
                entity_type: "candidate_match",
                entity_id: row.id,
                job_type: "rescore",
                status: "queued",
                trace_id,
            });
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
        }
        catch (err) {
            console.error("[freshness-reconcile] queue failed", row.id, err?.message);
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
export async function clearScoreStaleness(matchId) {
    try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
            .from("candidate_matches")
            .update({
            score_stale: false,
            score_stale_reasons: [],
            score_stale_at: null,
            rescore_queued_at: null,
        })
            .eq("id", matchId);
    }
    catch (err) {
        console.error("[freshness] clear failed", matchId, err?.message);
    }
}

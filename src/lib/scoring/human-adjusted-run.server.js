/**
 * Human overrides that reach the client (Prompt 10) — persistence.
 *
 * A reviewer's verdict on a requirement produces a NEW score run. A completed
 * run is never mutated (DB trigger `score_runs_immutable` also enforces this):
 * the adjusted run is inserted, stamped `evaluation_method = 'human_adjusted'`
 * with the overriding user and the mandatory reason recorded, and the match is
 * pointed at it. The machine run stays readable forever for comparison.
 *
 * Every verdict is also appended to `evidence_overrides` when a matching
 * evidence item exists, so the append-only override history stays the single
 * place to answer "who changed what, and why".
 */
import { applyHumanVerdicts, recomputeAdjustedScore, verifiedScoreShare, HUMAN_EVALUATION_METHOD, } from "./human-adjustment";
import { parseCalibration, resolveCalibration, serialiseCalibration, } from "./engine-calibration";
async function getAdmin() {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin;
}
async function actorName(s, userId) {
    const { data } = await s
        .from("profiles")
        .select("full_name,email")
        .eq("auth_user_id", userId)
        .maybeSingle();
    return data?.full_name || data?.email || "A reviewer";
}
function calibrationFor(result) {
    try {
        if (result?.calibration)
            return parseCalibration(result.calibration);
    }
    catch {
        /* fall through to the role-family default */
    }
    return resolveCalibration(result?.role_family ?? null);
}
/**
 * Record reviewer verdicts and publish the resulting human-adjusted run.
 */
export async function createHumanAdjustedRun(opts) {
    const s = await getAdmin();
    const { data: match } = await s
        .from("candidate_matches")
        .select("id,position_id,application_id,candidate_profile_id,organization_id,current_score_run_id")
        .eq("id", opts.matchId)
        .maybeSingle();
    if (!match)
        throw new Error("match_not_found");
    const { data: base } = await s
        .from("score_runs")
        .select("id,candidate_match_id,position_id,organization_id,rubric_version_id,blueprint_version,engine_version,score,raw_score,final_score,applied_cap,confidence,evidence_confidence,fit_label,must_have_coverage,preferred_coverage,contradiction_status,input_hash,evidence,requirement_coverage,explanation,result,completed_at")
        .eq("candidate_match_id", opts.matchId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
    if (!base)
        throw new Error("no_completed_run");
    const result = (base.result ?? {});
    const assessment = Array.isArray(result?.requirement_assessment)
        ? result.requirement_assessment
        : Array.isArray(base.requirement_coverage?.requirement_assessment)
            ? base.requirement_coverage.requirement_assessment
            : [];
    if (assessment.length === 0)
        throw new Error("no_requirement_assessment");
    const calibration = calibrationFor(result);
    const name = await actorName(s, opts.actorUserId);
    const now = new Date().toISOString();
    const records = opts.verdicts.map((v) => ({
        ...v,
        reason: v.reason.trim(),
        actor_user_id: opts.actorUserId,
        actor_name: name,
        at: now,
        machine_status: assessment.find((a) => a.id === v.requirement_id)?.machine_status ??
            assessment.find((a) => a.id === v.requirement_id)?.status ??
            null,
    }));
    const { assessment: adjusted, applied, unknownIds } = applyHumanVerdicts(assessment, records);
    if (applied.length === 0)
        throw new Error("no_matching_requirements");
    const weights = (result?.category_weights ?? null);
    const screeningApplied = weights ? Number(weights.screening_alignment ?? 0) > 0 : false;
    const screeningAlignment = screeningApplied
        ? Number(result?.category_breakdown?.screening_alignment ?? 0)
        : null;
    const carriedCaps = (Array.isArray(result?.applied_caps) ? result.applied_caps : [])
        .filter((c) => !String(c?.reason ?? "").startsWith("must_have_floor"))
        .map((c) => ({ reason: String(c.reason), cap: Number(c.cap) }));
    const adj = recomputeAdjustedScore({
        assessment: adjusted,
        screeningAlignment,
        calibration,
        carriedCaps,
        unknownLabel: base.fit_label === "unknown",
    });
    const verified = verifiedScoreShare(adjusted, adj.category_weights);
    const enrichedResult = {
        ...result,
        requirement_assessment: adjusted,
        category_weights: adj.category_weights,
        category_breakdown: {
            must_have: adj.must_have_coverage,
            preferred: adj.preferred_coverage,
            screening_alignment: screeningAlignment ?? 0,
        },
        calibration: serialiseCalibration(calibration),
        calibration_version: calibration.calibration_version,
        evaluation_method: HUMAN_EVALUATION_METHOD,
        applied_caps: adj.applied_caps,
        raw_score: adj.raw_score,
        score: adj.final_score,
        fit_label: adj.fit_label,
        // Provenance of the human step: who, when, why, and what changed.
        human_adjustment: {
            derived_from_run_id: base.id,
            actor_user_id: opts.actorUserId,
            actor_name: name,
            reason: opts.reason.trim(),
            at: now,
            verdicts: applied,
            unknown_requirement_ids: unknownIds,
        },
        verified_evidence: verified,
        reconciliation: {
            raw_computed: adj.raw_score,
            raw_declared: adj.raw_score,
            final_computed: adj.final_score,
            final_declared: adj.final_score,
            applied_cap: adj.applied_cap,
            cap_reasons: adj.applied_caps.map((c) => c.reason),
            ok: true,
        },
    };
    const explanation = [
        `${adj.fit_label.replace(/_/g, " ")} — score ${adj.final_score.toFixed(1)}/100 after human review`,
        `must-have coverage ${(adj.must_have_coverage * 100).toFixed(0)}%`,
        `${verified.human_verified} of ${verified.total} criteria human-verified`,
        ...(adj.cap_reason ? [`caps: ${adj.cap_reason}`] : []),
    ].join(" · ");
    // A human-adjusted run has the same machine inputs but a different verdict
    // set, so it must not collide with `score_runs_active_input_key` (one active
    // completed run per identical match+input+rubric). Stamp a derived hash.
    const runId = crypto.randomUUID();
    const humanInputHash = `${base.input_hash ?? "none"}+human:${runId.slice(0, 8)}`;
    const { data: run, error: insErr } = await s
        .from("score_runs")
        .insert({
        id: runId,
        candidate_match_id: opts.matchId,
        position_id: match.position_id,
        application_id: match.application_id,
        candidate_profile_id: match.candidate_profile_id,
        candidate_submission_id: match.application_id,
        organization_id: match.organization_id,
        blueprint_version: base.blueprint_version,
        rubric_version_id: base.rubric_version_id,
        raw_score: adj.raw_score,
        applied_cap: adj.applied_cap,
        cap_reason: adj.cap_reason,
        final_score: adj.final_score,
        // The one column that says a person, not the engine, set this number.
        evaluation_method: HUMAN_EVALUATION_METHOD,
        fit_band: adj.fit_label,
        engine_version: base.engine_version,
        score: adj.final_score,
        confidence: base.confidence,
        evidence_confidence: base.evidence_confidence,
        status: "completed",
        explanation,
        evidence: base.evidence,
        requirement_coverage: {
            must_have: adj.must_have_coverage,
            preferred: adj.preferred_coverage,
            screening_alignment: screeningAlignment ?? 0,
            category_weights: adj.category_weights,
            requirement_assessment: adjusted,
        },
        started_at: now,
        completed_at: now,
        trace_id: opts.traceId ?? `human-adj-${opts.matchId.slice(0, 8)}-${Date.now()}`,
        result: enrichedResult,
        fit_label: adj.fit_label,
        must_have_coverage: adj.must_have_coverage,
        preferred_coverage: adj.preferred_coverage,
        contradiction_status: base.contradiction_status,
        input_hash: humanInputHash,
    })
        .select("id")
        .single();
    if (insErr || !run)
        throw new Error(insErr?.message ?? "human_adjusted_insert_failed");
    // The machine run stays readable, but it is no longer the active one. A
    // failure here is not fatal to the adjustment, but it must not stay silent.
    const { error: supErr } = await s
        .from("score_runs")
        .update({
        superseded_at: now,
        superseded_by_run_id: run.id,
        superseded_reason: "human_adjusted",
    })
        .eq("id", base.id)
        .is("superseded_at", null);
    if (supErr) {
        console.error("[human-adjusted-run] could not supersede base run", base.id, supErr.message);
    }
    await s
        .from("candidate_matches")
        .update({ current_score_run_id: run.id })
        .eq("id", opts.matchId);
    // Append-only override history, and mark the matching evidence item as
    // reviewed. The machine `result` on the item is never rewritten here.
    const { data: items } = await s
        .from("candidate_evidence_items")
        .select("id,rubric_criterion_key,result,organization_id")
        .eq("candidate_match_id", opts.matchId);
    for (const v of applied) {
        const item = (items ?? []).find((i) => String(i.rubric_criterion_key ?? "") === v.requirement_id);
        await s.from("evidence_overrides").insert({
            evidence_item_id: item?.id ?? null,
            candidate_match_id: opts.matchId,
            organization_id: match.organization_id,
            actor_user_id: opts.actorUserId,
            reason: v.reason,
            before_state: {
                requirement_id: v.requirement_id,
                machine_status: v.machine_status,
                score_run_id: base.id,
            },
            after_state: {
                requirement_id: v.requirement_id,
                human_verdict: v.verdict,
                actor_name: name,
                score_run_id: run.id,
            },
        });
        if (item?.id) {
            await s
                .from("candidate_evidence_items")
                .update({
                reviewer_status: "edited",
                reviewer_note: v.reason,
                reviewed_by: opts.actorUserId,
                reviewed_at: now,
                last_reviewed_at: now,
            })
                .eq("id", item.id);
        }
    }
    await s.from("audit_events").insert({
        actor_user_id: opts.actorUserId,
        action: "score_human_adjusted",
        entity_type: "candidate_match",
        entity_id: opts.matchId,
        organization_id: match.organization_id,
        before_state: {
            run_id: base.id,
            final_score: base.final_score ?? base.score,
            fit_label: base.fit_label,
            evaluation_method: result?.evaluation_method ?? null,
        },
        after_state: {
            run_id: run.id,
            final_score: adj.final_score,
            fit_label: adj.fit_label,
            evaluation_method: HUMAN_EVALUATION_METHOD,
            reason: opts.reason.trim(),
            verdicts: applied.map((v) => ({
                requirement_id: v.requirement_id,
                verdict: v.verdict,
                machine_status: v.machine_status,
            })),
            verified_share: verified.weighted_share,
        },
    });
    return {
        ok: true,
        run_id: run.id,
        previous_run_id: base.id,
        raw_score: adj.raw_score,
        final_score: adj.final_score,
        applied_cap: adj.applied_cap,
        cap_reason: adj.cap_reason,
        fit_label: adj.fit_label,
        verified,
        applied,
        unknown_requirement_ids: unknownIds,
    };
}
/**
 * Read-side summary for staff surfaces: which criteria are machine-derived,
 * which are human-verified, and how much of the score rests on verification.
 */
export function summariseRunVerification(run) {
    const result = (run?.result ?? {});
    const assessment = Array.isArray(result?.requirement_assessment)
        ? result.requirement_assessment
        : [];
    const weights = (result?.category_weights ?? {
        must_have: 1,
        preferred: 0,
        screening_alignment: 0,
    });
    const adjustment = result?.human_adjustment ?? null;
    return {
        humanAdjusted: run?.evaluation_method === HUMAN_EVALUATION_METHOD,
        actorName: adjustment?.actor_name ?? null,
        at: adjustment?.at ?? null,
        reason: adjustment?.reason ?? null,
        rows: assessment.map((a) => ({
            id: String(a.id),
            text: String(a.text ?? a.id),
            required: a.required !== false,
            status: String(a.status ?? "unknown"),
            source: a.human_verified === true ? "human" : "machine",
            machine_status: a.machine_status ?? null,
            verdict: a.human_verdict ?? null,
            reason: a.human_reason ?? null,
            actor_name: a.human_actor_name ?? null,
            not_applicable: a.not_applicable === true,
        })),
        verified: verifiedScoreShare(assessment, {
            must_have: Number(weights.must_have ?? 1),
            preferred: Number(weights.preferred ?? 0),
            screening_alignment: Number(weights.screening_alignment ?? 0),
        }),
    };
}

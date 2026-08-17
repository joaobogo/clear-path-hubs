/**
 * Score-run replay — the proof that a stored score reproduces exactly.
 *
 * A score is only auditable if it can be recomputed. That needs three things,
 * all of which are now persisted:
 *
 *   1. the inputs (CV text, requirements, screening answers) — stored on
 *      `score_runs.result.inputs`,
 *   2. every engine constant — stored on `rubric_versions.calibration`,
 *   3. the engine build — stored on `score_runs.engine_version`.
 *
 * This module is the pure half: snapshot shape, and the drift comparison. The
 * database half lives in replay.server.ts.
 */
import { z } from "zod";
export const ReplayRequirementSchema = z.object({
    id: z.string(),
    text: z.string(),
    required: z.boolean(),
    keywords: z.array(z.string()).default([]),
});
export const ReplayScreeningSchema = z.object({
    question_id: z.string(),
    question: z.string().default(""),
    required: z.boolean().default(false),
    answer_type: z.string().default("text"),
    value: z.unknown().nullable(),
    disqualifying_condition: z
        .object({
        operator: z.enum(["equals", "min", "max"]),
        value: z.unknown(),
    })
        .nullable()
        .optional(),
});
export const ReplaySnapshotSchema = z.object({
    cv_text: z.string(),
    requirements: z.array(ReplayRequirementSchema),
    screening: z.array(ReplayScreeningSchema),
    role_family: z.string().nullable().default(null),
});
/** Canonical snapshot builder used at write time. */
export function buildReplaySnapshot(input) {
    return {
        cv_text: input.cv_text,
        requirements: input.requirements.map((r) => ({
            id: r.id,
            text: r.text,
            required: r.required,
            keywords: r.keywords ?? [],
        })),
        screening: input.screening.map((s) => ({
            question_id: s.question_id,
            question: s.question ?? "",
            required: s.required ?? false,
            answer_type: s.answer_type ?? "text",
            value: (s.value ?? null),
            disqualifying_condition: s.disqualifying_condition ?? null,
        })),
        role_family: input.role_family ?? null,
    };
}
export function fingerprintOf(result) {
    const caps = result.applied_caps ?? [];
    return {
        raw_score: result.raw_score,
        score: result.score,
        fit_label: result.fit_label,
        overall_confidence: result.overall_confidence,
        evidence_confidence: result.evidence_confidence,
        must_have_coverage: result.must_have_coverage,
        preferred_coverage: result.preferred_coverage,
        category_weights: result.category_weights,
        applied_cap: caps.length
            ? Math.round(Math.min(...caps.map((c) => c.cap)) * 1000) / 10
            : null,
        input_hash: result.input_hash,
        statuses: result.requirement_assessment
            .map((a) => ({ id: a.id, status: a.status }))
            .sort((a, b) => a.id.localeCompare(b.id)),
    };
}
const NUMERIC_TOLERANCE = 0.001;
/**
 * Compare stored vs recomputed. Any difference is drift — a named, readable
 * reason rather than a boolean, so a failing test says what moved.
 */
export function diffReplay(stored, recomputed) {
    const drift = [];
    const num = (label, a, b) => {
        if (a === null || b === null) {
            if (a !== b)
                drift.push(`${label}: stored=${a} replay=${b}`);
            return;
        }
        if (Math.abs(a - b) > NUMERIC_TOLERANCE)
            drift.push(`${label}: stored=${a} replay=${b}`);
    };
    num("raw_score", stored.raw_score, recomputed.raw_score);
    num("score", stored.score, recomputed.score);
    num("overall_confidence", stored.overall_confidence, recomputed.overall_confidence);
    num("evidence_confidence", stored.evidence_confidence, recomputed.evidence_confidence);
    num("must_have_coverage", stored.must_have_coverage, recomputed.must_have_coverage);
    num("preferred_coverage", stored.preferred_coverage, recomputed.preferred_coverage);
    num("applied_cap", stored.applied_cap, recomputed.applied_cap);
    num("weight.must_have", stored.category_weights.must_have, recomputed.category_weights.must_have);
    num("weight.preferred", stored.category_weights.preferred, recomputed.category_weights.preferred);
    num("weight.screening_alignment", stored.category_weights.screening_alignment, recomputed.category_weights.screening_alignment);
    if (stored.fit_label !== recomputed.fit_label) {
        drift.push(`fit_label: stored=${stored.fit_label} replay=${recomputed.fit_label}`);
    }
    if (stored.input_hash !== recomputed.input_hash) {
        drift.push(`input_hash: stored=${stored.input_hash} replay=${recomputed.input_hash}`);
    }
    const storedStatuses = new Map(stored.statuses.map((r) => [r.id, r.status]));
    for (const row of recomputed.statuses) {
        const was = storedStatuses.get(row.id);
        if (was === undefined) {
            drift.push(`requirement_added: ${row.id}`);
        }
        else if (was !== row.status) {
            drift.push(`requirement ${row.id}: stored=${was} replay=${row.status}`);
        }
        storedStatuses.delete(row.id);
    }
    for (const [id] of storedStatuses)
        drift.push(`requirement_missing: ${id}`);
    return { identical: drift.length === 0, drift };
}

// Score-run replay against the database. SERVER-ONLY.
//
// Given a score_run id, recompute the score from the run's stored inputs and the
// calibration on its governing rubric version, then diff against what was
// stored. Drift means the run is no longer reproducible — either the engine
// changed behaviour without a version bump, or something mutated a published
// rubric version.

import { scoreCandidate, type RequirementInput, type ScreeningAnswer } from "../scoring-engine.server";
import { parseCalibration } from "./engine-calibration";
import {
  ReplaySnapshotSchema,
  diffReplay,
  fingerprintOf,
  type ReplayFingerprint,
  type ReplaySnapshot,
} from "./replay";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export type ReplayOutcome =
  | {
      ok: true;
      run_id: string;
      rubric_version_id: string;
      calibration_version: string;
      stored_engine_version: string;
      replay_engine_version: string;
      identical: boolean;
      drift: string[];
      stored: ReplayFingerprint;
      recomputed: ReplayFingerprint;
    }
  | { ok: false; run_id: string; code: string; message: string };

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Any;
}

/** Recompute a stored score run from its own inputs + its own rubric version. */
export async function replayScoreRun(runId: string): Promise<ReplayOutcome> {
  const s = await getAdmin();
  const { data: run, error } = await s
    .from("score_runs")
    .select("id,rubric_version_id,engine_version,result,requirement_coverage,raw_score,final_score,applied_cap,fit_label,confidence,evidence_confidence,must_have_coverage,preferred_coverage,input_hash,status")
    .eq("id", runId)
    .maybeSingle();
  if (error) return { ok: false, run_id: runId, code: "run_read_failed", message: error.message };
  if (!run) return { ok: false, run_id: runId, code: "run_not_found", message: "No such score run." };

  const result = (run.result ?? {}) as Record<string, unknown>;
  const parsedSnapshot = ReplaySnapshotSchema.safeParse(result.inputs);
  if (!parsedSnapshot.success) {
    return {
      ok: false,
      run_id: runId,
      code: "inputs_not_stored",
      message:
        "This run predates stored replay inputs, so it cannot be recomputed. Rescore the match to produce a replayable run.",
    };
  }
  const snapshot: ReplaySnapshot = parsedSnapshot.data;

  const { data: rubric } = await s
    .from("rubric_versions")
    .select("id,calibration,engine_version")
    .eq("id", run.rubric_version_id)
    .maybeSingle();
  if (!rubric) {
    return {
      ok: false,
      run_id: runId,
      code: "rubric_version_not_found",
      message: "The rubric version behind this run is missing.",
    };
  }
  const calibration = parseCalibration(rubric.calibration);

  const recomputedResult = scoreCandidate({
    cv_text: snapshot.cv_text,
    requirements: snapshot.requirements as RequirementInput[],
    screening: snapshot.screening as unknown as ScreeningAnswer[],
    calibration,
  });

  // Prefer the fingerprint the engine itself recorded; fall back to the
  // first-class columns for runs written before the result envelope grew.
  const storedFingerprint: ReplayFingerprint = {
    raw_score: Number(result.raw_score ?? run.raw_score ?? 0),
    score: Number(result.score ?? run.final_score ?? 0),
    fit_label: String(result.fit_label ?? run.fit_label ?? "unknown"),
    overall_confidence: Number(result.overall_confidence ?? run.confidence ?? 0),
    evidence_confidence: Number(result.evidence_confidence ?? run.evidence_confidence ?? 0),
    must_have_coverage: Number(result.must_have_coverage ?? run.must_have_coverage ?? 0),
    preferred_coverage: Number(result.preferred_coverage ?? run.preferred_coverage ?? 0),
    category_weights: (result.category_weights as ReplayFingerprint["category_weights"]) ??
      ((run.requirement_coverage as Any)?.category_weights as ReplayFingerprint["category_weights"]) ?? {
        must_have: 1,
        preferred: 0,
        screening_alignment: 0,
      },
    applied_cap: run.applied_cap === null || run.applied_cap === undefined ? null : Number(run.applied_cap),
    input_hash: String(result.input_hash ?? run.input_hash ?? ""),
    statuses: Array.isArray((run.requirement_coverage as Any)?.requirement_assessment)
      ? ((run.requirement_coverage as Any).requirement_assessment as Array<{ id: string; status: string }>)
          .map((a) => ({ id: a.id, status: a.status }))
          .sort((a, b) => a.id.localeCompare(b.id))
      : [],
  };

  const recomputed = fingerprintOf(recomputedResult);
  const { identical, drift } = diffReplay(storedFingerprint, recomputed);

  return {
    ok: true,
    run_id: runId,
    rubric_version_id: run.rubric_version_id,
    calibration_version: calibration.calibration_version,
    stored_engine_version: String(run.engine_version ?? ""),
    replay_engine_version: recomputedResult.engine_version,
    identical,
    drift,
    stored: storedFingerprint,
    recomputed,
  };
}

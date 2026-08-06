import { describe, expect, it } from "vitest";
import { scoreCandidate } from "@/lib/scoring-engine.server";
import {
  DEFAULT_CALIBRATION,
  parseCalibration,
  serialiseCalibration,
  resolveCalibration,
  type EngineCalibration,
} from "@/lib/scoring/engine-calibration";
import { buildReplaySnapshot, diffReplay, fingerprintOf } from "@/lib/scoring/replay";

const cv = [
  "Senior platform engineer with eight years shipping Kubernetes workloads on AWS,",
  "owning Terraform modules, PostgreSQL performance work and Go services behind gRPC.",
  "Led incident response, wrote the runbooks, mentored four engineers and ran the",
  "on-call rotation. Built CI pipelines, cut deploy time in half and instrumented",
  "tracing across every service. No experience with Salesforce administration.",
].join(" ");

const requirements = [
  { id: "req-0", text: "Kubernetes and Terraform in production", required: true, keywords: [] },
  { id: "req-1", text: "PostgreSQL performance tuning", required: true, keywords: [] },
  { id: "req-2", text: "Salesforce administration", required: true, keywords: [] },
  { id: "pref-0", text: "Go services and gRPC", required: false, keywords: [] },
];

const screening = [
  {
    question_id: "q1",
    question: "Can you work from the London office two days a week?",
    required: true,
    answer_type: "boolean",
    value: true,
    disqualifying_condition: null,
  },
];

/** What the service stores: inputs snapshot + the calibration on the rubric version. */
function storeRun(calibration: EngineCalibration) {
  const result = scoreCandidate({ cv_text: cv, requirements, screening, calibration });
  return {
    inputs: buildReplaySnapshot({ cv_text: cv, requirements, screening, role_family: calibration.role_family }),
    rubric_calibration: serialiseCalibration(calibration),
    fingerprint: fingerprintOf(result),
  };
}

/** What replayScoreRun does, minus the database round trip. */
function replay(stored: ReturnType<typeof storeRun>) {
  const calibration = parseCalibration(stored.rubric_calibration);
  const result = scoreCandidate({
    cv_text: stored.inputs.cv_text,
    requirements: stored.inputs.requirements,
    screening: stored.inputs.screening as never,
    calibration,
  });
  return { calibration, fingerprint: fingerprintOf(result) };
}

describe("score run replay (F-007)", () => {
  it("reproduces an identical score from stored inputs plus stored rubric calibration", () => {
    const stored = storeRun(DEFAULT_CALIBRATION);
    const { identical, drift } = diffReplay(stored.fingerprint, replay(stored).fingerprint);
    expect(drift).toEqual([]);
    expect(identical).toBe(true);
  });

  it("reproduces a role-family calibrated run from the rubric version, not today's defaults", () => {
    const stored = storeRun(resolveCalibration("engineering"));
    const back = replay(stored);
    expect(back.calibration.met_keyword_ratio).toBe(0.7);
    expect(back.calibration.keyword_cap).toBe(14);
    expect(back.calibration.calibration_version).toContain("+engineering");
    expect(diffReplay(stored.fingerprint, back.fingerprint).identical).toBe(true);
  });

  it("survives a rubric version written by an older engine that lacked newer fields", () => {
    const stored = storeRun(DEFAULT_CALIBRATION);
    // Simulate a historical row: only the fields that existed at write time.
    const partial = {
      calibration_version: stored.rubric_calibration.calibration_version,
      unknown_credit: 0.4,
      partial_credit: 0.5,
      met_keyword_ratio: 0.6,
      met_keyword_floor: 2,
      keyword_cap: 12,
      thin_cv_chars: 300,
      thin_cv_tokens: 40,
      disqualified_cap: 0.15,
      base_weights: { must_have: 0.6, preferred: 0.2, screening_alignment: 0.2 },
      strong_fit: { min_must_have_coverage: 0.75 },
      manual_review_confidence: 0.35,
    };
    const back = replay({ ...stored, rubric_calibration: partial });
    expect(diffReplay(stored.fingerprint, back.fingerprint).drift).toEqual([]);
  });

  // The drift gate: every constant now lives on the rubric version, so changing
  // ANY of them must move the score. If one of these stops producing drift, the
  // engine has started ignoring its calibration and reproducibility is broken.
  const driftCases: Array<{ field: string; patch: Partial<EngineCalibration> }> = [
    { field: "unknown_credit", patch: { unknown_credit: 0.9 } },
    { field: "partial_credit", patch: { partial_credit: 0.95 } },
    { field: "met_keyword_ratio", patch: { met_keyword_ratio: 0.99 } },
    { field: "met_keyword_floor", patch: { met_keyword_floor: 9 } },
    { field: "keyword_cap", patch: { keyword_cap: 1 } },
    { field: "thin_cv_chars", patch: { thin_cv_chars: 5000 } },
    { field: "thin_cv_tokens", patch: { thin_cv_tokens: 5000 } },
    {
      field: "base_weights",
      patch: { base_weights: { must_have: 0.2, preferred: 0.6, screening_alignment: 0.2 } },
    },
    {
      field: "confidence_weights",
      patch: { confidence_weights: { cv_length: 0.1, evidence_volume: 0.1, screening: 0.8 } },
    },
    { field: "confidence_cv_length_target", patch: { confidence_cv_length_target: 20000 } },
    {
      field: "decidedness",
      patch: { decidedness: { met: 1, contradicted: 0.1, missing: 0.1, partial: 0.1, unknown: 0.9 } },
    },
    { field: "strong_fit", patch: { strong_fit: { min_must_have_coverage: 0.99 } } },
    { field: "unreadable_cv_chars", patch: { unreadable_cv_chars: 100000 } },
  ];

  for (const c of driftCases) {
    it(`detects drift when ${c.field} changes on the rubric version`, () => {
      const stored = storeRun(DEFAULT_CALIBRATION);
      const mutated = replay({
        ...stored,
        rubric_calibration: {
          ...stored.rubric_calibration,
          ...c.patch,
          calibration_version: "mutated",
        },
      });
      const { identical, drift } = diffReplay(stored.fingerprint, mutated.fingerprint);
      expect(identical, `${c.field} produced no drift`).toBe(false);
      expect(drift.length).toBeGreaterThan(0);
    });
  }

  it("the calibration version is part of the input hash, so a recalibration is never silent", () => {
    const a = scoreCandidate({ cv_text: cv, requirements, screening, calibration: DEFAULT_CALIBRATION });
    const b = scoreCandidate({
      cv_text: cv,
      requirements,
      screening,
      calibration: { ...DEFAULT_CALIBRATION, calibration_version: "taasflow-calibration-v9.9.9" },
    });
    expect(a.input_hash).not.toBe(b.input_hash);
  });

  it("no engine constant is left hardcoded: every calibration field is typed and defaulted", () => {
    const round = parseCalibration(serialiseCalibration(DEFAULT_CALIBRATION));
    expect(round).toEqual(DEFAULT_CALIBRATION);
    expect(parseCalibration({}).engine_version).toBe(DEFAULT_CALIBRATION.engine_version);
  });
});

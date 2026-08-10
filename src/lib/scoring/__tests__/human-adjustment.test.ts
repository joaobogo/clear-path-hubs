import { describe, expect, it } from "vitest";
import {
  applyHumanVerdicts,
  recomputeAdjustedScore,
  verifiedScoreShare,
  clientReviewStatement,
  type AssessmentRow,
  type HumanVerdictRecord,
} from "../human-adjustment";
import { DEFAULT_CALIBRATION } from "../engine-calibration";

const rows: AssessmentRow[] = [
  { id: "r1", text: "5 years Node", required: true, status: "unknown" },
  { id: "r2", text: "Team lead", required: true, status: "missing" },
  { id: "r3", text: "Nice-to-have: Kubernetes", required: false, status: "missing" },
];

const verdict = (
  id: string,
  v: "met" | "not_met" | "not_applicable",
): HumanVerdictRecord => ({
  requirement_id: id,
  verdict: v,
  reason: "Confirmed in the interview",
  actor_user_id: "u-1",
  actor_name: "Ana Reviewer",
  at: "2026-01-01T00:00:00.000Z",
  machine_status: null,
});

describe("applyHumanVerdicts", () => {
  it("records who decided what, keeping the machine status", () => {
    const { assessment, applied, unknownIds } = applyHumanVerdicts(rows, [verdict("r1", "met")]);
    expect(applied).toHaveLength(1);
    expect(unknownIds).toEqual([]);
    expect(assessment[0]!.status).toBe("met");
    expect(assessment[0]!.human_verified).toBe(true);
    expect(assessment[0]!.machine_status).toBe("unknown");
    // untouched rows stay machine-derived
    expect(assessment[1]!.human_verified).toBeUndefined();
  });

  it("reports verdicts that match no requirement", () => {
    const { unknownIds } = applyHumanVerdicts(rows, [verdict("nope", "met")]);
    expect(unknownIds).toEqual(["nope"]);
  });
});

describe("recomputeAdjustedScore", () => {
  it("raises the score when a must-have is verified met", () => {
    const before = recomputeAdjustedScore({
      assessment: rows,
      screeningAlignment: null,
      calibration: DEFAULT_CALIBRATION,
    });
    const { assessment } = applyHumanVerdicts(rows, [verdict("r1", "met"), verdict("r2", "met")]);
    const after = recomputeAdjustedScore({
      assessment,
      screeningAlignment: null,
      calibration: DEFAULT_CALIBRATION,
    });
    expect(after.raw_score).toBeGreaterThan(before.raw_score);
    expect(after.must_have_coverage).toBe(1);
  });

  it("removes not-applicable criteria from the denominator instead of zeroing them", () => {
    const zeroed = applyHumanVerdicts(rows, [verdict("r3", "not_met")]).assessment;
    const excluded = applyHumanVerdicts(rows, [verdict("r3", "not_applicable")]).assessment;
    const a = recomputeAdjustedScore({
      assessment: zeroed,
      screeningAlignment: null,
      calibration: DEFAULT_CALIBRATION,
    });
    const b = recomputeAdjustedScore({
      assessment: excluded,
      screeningAlignment: null,
      calibration: DEFAULT_CALIBRATION,
    });
    expect(b.raw_score).toBeGreaterThanOrEqual(a.raw_score);
    expect(b.preferred_coverage).toBe(0);
  });

  it("writes null applied_cap when nothing clamped the run", () => {
    const { assessment } = applyHumanVerdicts(rows, [
      verdict("r1", "met"),
      verdict("r2", "met"),
      verdict("r3", "met"),
    ]);
    const out = recomputeAdjustedScore({
      assessment,
      screeningAlignment: null,
      calibration: DEFAULT_CALIBRATION,
    });
    expect(out.applied_cap).toBeNull();
    expect(out.cap_reason).toBeNull();
    expect(out.final_score).toBe(out.raw_score);
  });

  it("carries input-derived caps forward and records them separately", () => {
    const { assessment } = applyHumanVerdicts(rows, [verdict("r1", "met"), verdict("r2", "met")]);
    const out = recomputeAdjustedScore({
      assessment,
      screeningAlignment: null,
      calibration: DEFAULT_CALIBRATION,
      carriedCaps: [{ reason: "unparsed_cv: no text", cap: 0.3 }],
    });
    // Reported on the 0-100 scale, matching raw_score/final_score and the
    // score_runs.applied_cap column the value is persisted to.
    expect(out.applied_cap).toBe(30);
    expect(out.final_score).toBeLessThanOrEqual(out.applied_cap!);
    expect(out.cap_reason).toContain("unparsed_cv");
    expect(out.raw_score).toBeGreaterThan(out.final_score);

  });
});

describe("verifiedScoreShare", () => {
  it("reports zero verification for a purely machine assessment", () => {
    const v = verifiedScoreShare(rows, { must_have: 0.7, preferred: 0.3, screening_alignment: 0 });
    expect(v.human_verified).toBe(0);
    expect(v.weighted_share).toBe(0);
    expect(v.line).toContain("machine-derived");
  });

  it("weights the verified share by the applied category weights", () => {
    const { assessment } = applyHumanVerdicts(rows, [verdict("r1", "met"), verdict("r2", "met")]);
    const v = verifiedScoreShare(assessment, {
      must_have: 0.7,
      preferred: 0.3,
      screening_alignment: 0,
    });
    expect(v.human_verified).toBe(2);
    // all must-haves verified, no preferred verified -> 0.7 of the weight
    expect(v.weighted_share).toBeCloseTo(0.7, 4);
  });
});

describe("clientReviewStatement", () => {
  it("says nothing when no human touched the assessment", () => {
    expect(clientReviewStatement({ humanAdjusted: false })).toBeNull();
  });

  it("states the review without leaking the reviewer's note", () => {
    const line = clientReviewStatement({ humanAdjusted: true, verifiedCount: 2 })!;
    expect(line).toContain("specialist reviewed");
    expect(line).not.toContain("Confirmed in the interview");
  });
});

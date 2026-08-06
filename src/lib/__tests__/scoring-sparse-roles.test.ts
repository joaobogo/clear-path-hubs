import { describe, it, expect } from "vitest";
import { scoreCandidate } from "@/lib/scoring-engine.server";

/**
 * Prompt 6 gate: absent dimensions leave the denominator, they are never
 * credited with a neutral half-score.
 */
const richCv = [
  "Office administrator handling scheduling, invoices, supplier calls, filing, reception cover,",
  "travel booking, expense reconciliation, meeting minutes, onboarding packs and office supplies",
  "across two sites for six years. Built the induction handbook, ran the visitor policy refresh,",
  "coordinated facilities contractors, tracked purchase orders and owned the stationery budget.",
].join(" ");

const mustHaves = [
  { id: "a", text: "Kubernetes", required: true, keywords: ["kubernetes"] },
  { id: "b", text: "Terraform", required: true, keywords: ["terraform"] },
];

describe("sparse roles earn no unearned score (F-006)", () => {
  it("a must-haves-only role with nothing evidenced scores exactly zero", () => {
    const r = scoreCandidate({ cv_text: richCv, requirements: mustHaves, screening: [] });
    expect(r.requirement_assessment.every((a) => a.status === "missing")).toBe(true);
    // Previously the absent preferred dimension defaulted to 0.5 and paid out.
    expect(r.score).toBe(0);
  });

  it("absent dimensions carry zero weight and must-haves absorb it", () => {
    const r = scoreCandidate({ cv_text: richCv, requirements: mustHaves, screening: [] });
    expect(r.category_weights.preferred).toBe(0);
    expect(r.category_weights.screening_alignment).toBe(0);
    expect(r.category_weights.must_have).toBe(1);
  });

  it("adding a preferred requirement reintroduces that dimension's weight", () => {
    const r = scoreCandidate({
      cv_text: richCv,
      requirements: [...mustHaves, { id: "c", text: "Scheduling", required: false, keywords: ["scheduling"] }],
      screening: [],
    });
    expect(r.category_weights.preferred).toBeGreaterThan(0);
    expect(r.category_weights.must_have).toBeLessThan(1);
    // The weights actually applied always sum to 1.
    const total =
      r.category_weights.must_have + r.category_weights.preferred + r.category_weights.screening_alignment;
    expect(total).toBeCloseTo(1, 4);
  });

  it("screening-free roles do not earn the screening dimension's weight", () => {
    const r = scoreCandidate({ cv_text: richCv, requirements: mustHaves, screening: [] });
    expect(r.category_breakdown.screening_alignment).toBe(0);
    expect(r.category_weights.screening_alignment).toBe(0);
  });
});

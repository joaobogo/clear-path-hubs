import { describe, expect, it } from "vitest";
import {
  combineCategories,
  findTermMatches,
  isNegatedMention,
  renormaliseWeights,
  scoreCandidate,
} from "@/lib/scoring-engine.server";

const LONG_CV = `
Senior backend engineer with eight years of production experience.
Built and operated JavaScript services for a payments platform serving
millions of requests per day. Owned delivery of the checkout rewrite,
led the migration to a modular monolith, and mentored four engineers.
No experience with Kubernetes or container orchestration in production.
Comfortable with Postgres, Redis, queueing, observability and on-call.
`.repeat(2);

function req(id: string, text: string, required = true) {
  return { id, text, required, keywords: [] as string[] };
}

describe("term matching is whole-term, not substring", () => {
  it("does not match java inside javascript", () => {
    expect(findTermMatches("I write javascript daily", "java")).toHaveLength(0);
    expect(findTermMatches("I write java daily", "java")).toHaveLength(1);
  });

  it("still matches punctuated technologies", () => {
    expect(findTermMatches("built with node.js and c++", "node.js")).toHaveLength(1);
    expect(findTermMatches("built with node.js and c++", "c++")).toHaveLength(1);
  });
});

describe("negation handling", () => {
  it("recognises a negated mention", () => {
    const cv = "No experience with Kubernetes.";
    const idx = findTermMatches(cv, "kubernetes")[0]!;
    expect(isNegatedMention(cv, idx)).toBe(true);
  });

  it("does not negate a positive mention in a later sentence", () => {
    const cv = "No experience with Docker. Ran Kubernetes in production.";
    const idx = findTermMatches(cv, "kubernetes")[0]!;
    expect(isNegatedMention(cv, idx)).toBe(false);
  });

  it("marks a requirement contradicted when every mention is negated", () => {
    const result = scoreCandidate({
      cv_text: LONG_CV,
      requirements: [req("r1", "Kubernetes")],
      screening: [],
    });
    expect(result.requirement_assessment[0]!.status).toBe("contradicted");
  });
});

describe("absent categories award no free points", () => {
  it("drops preferred and screening weight when there is no such input", () => {
    const result = scoreCandidate({
      cv_text: LONG_CV,
      requirements: [req("r1", "JavaScript payments platform")],
      screening: [],
    });
    expect(result.category_weights.preferred).toBe(0);
    expect(result.category_weights.screening_alignment).toBe(0);
    expect(result.category_weights.must_have).toBe(1);
    expect(result.category_breakdown.preferred).toBe(0);
  });

  it("keeps applied weights summing to one", () => {
    const w = renormaliseWeights({ must_have: 0.6, preferred: 0, screening_alignment: 0.2 });
    expect(w.must_have + w.preferred + w.screening_alignment).toBeCloseTo(1, 4);
  });

  it("reproduces the score from breakdown x weights", () => {
    const result = scoreCandidate({
      cv_text: LONG_CV,
      requirements: [req("r1", "JavaScript payments platform"), req("r2", "Redis", false)],
      screening: [],
    });
    const recomputed =
      Math.round(combineCategories(result.category_breakdown, result.category_weights) * 1000) / 10;
    expect(Math.abs(recomputed - result.score)).toBeLessThan(0.15);
  });
});

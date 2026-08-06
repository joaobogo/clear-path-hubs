import { describe, it, expect } from "vitest";
import { scoreCandidate } from "@/lib/scoring-engine.server";

const reqs = [
  { id: "r1", text: "React and TypeScript", required: true, keywords: ["react", "typescript"] },
  { id: "r2", text: "Postgres", required: true, keywords: ["postgres"] },
  { id: "r3", text: "AWS", required: false, keywords: ["aws"] },
];

const richCv = [
  "Senior engineer with 8 years of React and TypeScript across large single page applications.",
  "Owned Postgres migrations, wrote SQL, tuned indexes on production workloads at scale.",
  "Deployed AWS ECS services with Terraform, ran incident reviews and mentored engineers.",
  "Built design systems, accessibility audits, CI pipelines, and release automation.",
].join(" ");

describe("scoring confidence (F-004)", () => {
  it("never returns the old constant 0.8 for both thin and rich inputs", () => {
    const thin = scoreCandidate({
      cv_text: "Short bio. Loves shipping product.",
      requirements: reqs,
      screening: [],
    });
    const rich = scoreCandidate({ cv_text: richCv, requirements: reqs, screening: [] });
    expect(thin.overall_confidence).not.toBe(0.8);
    expect(thin.overall_confidence).toBeLessThan(rich.overall_confidence);
  });

  it("evidence_confidence is 0-100 and rises as the rubric gets decided", () => {
    const thin = scoreCandidate({
      cv_text: "Short bio. Loves shipping product.",
      requirements: reqs,
      screening: [],
    });
    const rich = scoreCandidate({ cv_text: richCv, requirements: reqs, screening: [] });

    for (const r of [thin, rich]) {
      expect(r.evidence_confidence).toBeGreaterThanOrEqual(0);
      expect(r.evidence_confidence).toBeLessThanOrEqual(100);
    }
    // An all-unknown assessment decided nothing; a matched one decided most of it.
    expect(thin.evidence_confidence).toBe(0);
    expect(rich.evidence_confidence).toBeGreaterThan(50);
  });

  it("is a distinct signal from overall_confidence", () => {
    const r = scoreCandidate({ cv_text: richCv, requirements: reqs, screening: [] });
    // Different scales (0-1 vs 0-100) and different inputs, so never interchangeable.
    expect(r.evidence_confidence).not.toBe(r.overall_confidence);
  });

  it("identical inputs produce an identical input_hash, so runs can be reused", () => {
    const a = scoreCandidate({ cv_text: richCv, requirements: reqs, screening: [] });
    const b = scoreCandidate({ cv_text: richCv, requirements: reqs, screening: [] });
    expect(a.input_hash).toBe(b.input_hash);
    expect(a.score).toBe(b.score);
    expect(a.evidence_confidence).toBe(b.evidence_confidence);
  });
});

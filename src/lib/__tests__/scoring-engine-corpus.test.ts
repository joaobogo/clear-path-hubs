import { describe, it, expect } from "vitest";
import { scoreCandidate } from "@/lib/scoring-engine.server";
import { FIXTURES } from "@/lib/scoring/golden-corpus";

/**
 * Engine regression corpus (Prompt 5).
 *
 * Status-level gate: every future engine change must keep these statuses.
 * Fixtures live in src/lib/scoring/golden-corpus.ts, shared with the
 * golden-score gate in src/lib/scoring/__tests__/golden-scores.test.ts.
 */


describe("scoring engine — fixture regression corpus (F-005)", () => {
  it("covers at least 30 CV/requirement pairs", () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(30);
  });

  for (const f of FIXTURES) {
    it(f.name, () => {
      const r = scoreCandidate({
        cv_text: f.cv,
        requirements: [f.requirement],
        screening: [],
      });
      const a = r.requirement_assessment[0]!;
      expect(a.status).toBe(f.expected);
      // Contradictions must always carry the snippet that justifies them.
      if (f.expected === "contradicted") {
        expect(a.evidence.length).toBeGreaterThan(0);
        expect(a.evidence[0]!.snippet.length).toBeGreaterThan(10);
      }
    });
  }
});

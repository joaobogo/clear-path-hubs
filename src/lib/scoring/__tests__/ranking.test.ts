import { describe, expect, it } from "vitest";
import { rankCandidates } from "../ranking";

const mk = (o: Partial<Parameters<typeof rankCandidates>[0][number]> & { id: string }) => ({
  id: o.id,
  eligibility: o.eligibility ?? "eligible",
  recommendation: o.recommendation ?? "review",
  fit_score: o.fit_score ?? null,
  evidence_confidence: o.evidence_confidence ?? null,
  tie_breakers: o.tie_breakers,
  published: o.published,
});

describe("rankCandidates", () => {
  it("eligibility beats fit — a 60 that's eligible ranks above a 95 that's not", () => {
    const ordered = rankCandidates([
      mk({ id: "b", eligibility: "not_eligible", recommendation: "do_not_recommend", fit_score: 95 }),
      mk({ id: "a", eligibility: "eligible", recommendation: "review", fit_score: 60 }),
    ]);
    expect(ordered[0].id).toBe("a");
  });

  it("recommendation beats fit — shortlist@72 above review@80", () => {
    const ordered = rankCandidates([
      mk({ id: "review", recommendation: "review", fit_score: 80 }),
      mk({ id: "short", recommendation: "shortlist", fit_score: 72 }),
    ]);
    expect(ordered[0].id).toBe("short");
  });

  it("ties break deterministically by id", () => {
    const ordered = rankCandidates([
      mk({ id: "z", fit_score: 80, evidence_confidence: 80 }),
      mk({ id: "a", fit_score: 80, evidence_confidence: 80 }),
      mk({ id: "m", fit_score: 80, evidence_confidence: 80 }),
    ]);
    expect(ordered.map((r) => r.id)).toEqual(["a", "m", "z"]);
  });

  it("drops unpublished when clientVisibleOnly", () => {
    const ordered = rankCandidates(
      [
        mk({ id: "a", fit_score: 90, published: false }),
        mk({ id: "b", fit_score: 70, published: true }),
      ],
      { clientVisibleOnly: true },
    );
    expect(ordered.map((r) => r.id)).toEqual(["b"]);
  });

  it("confidence breaks fit ties", () => {
    const ordered = rankCandidates([
      mk({ id: "lowconf", fit_score: 80, evidence_confidence: 40 }),
      mk({ id: "hiconf", fit_score: 80, evidence_confidence: 90 }),
    ]);
    expect(ordered[0].id).toBe("hiconf");
  });
});

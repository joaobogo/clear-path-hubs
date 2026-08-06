import { describe, expect, it } from "vitest";
import { resolveEligibility, resolveEligibilityFromRows } from "../eligibility";
import { deriveRecommendation } from "../recommendation";

describe("resolveEligibility", () => {
  it("no checks -> eligible", () => {
    expect(resolveEligibility([]).status).toBe("eligible");
  });

  it("confirmed disqualifier -> not_eligible", () => {
    const r = resolveEligibility([
      { qualifier_key: "work_auth", qualifier_kind: "disqualifier", status: "failed" },
    ]);
    expect(r.status).toBe("not_eligible");
    expect(r.blocking_checks).toHaveLength(1);
  });

  it("unknown hard qualifier -> needs_validation (NOT zero, NOT eligible)", () => {
    const r = resolveEligibility([
      { qualifier_key: "license", qualifier_kind: "qualifier", status: "unknown" },
    ]);
    expect(r.status).toBe("needs_validation");
  });

  it("active exception on failed check -> excepted", () => {
    const r = resolveEligibility([
      {
        qualifier_key: "work_auth",
        qualifier_kind: "disqualifier",
        status: "failed",
        has_active_exception: true,
      },
    ]);
    expect(r.status).toBe("excepted");
    expect(r.excepted_checks).toHaveLength(1);
  });

  it("failed dominates unknown", () => {
    const r = resolveEligibility([
      { qualifier_key: "a", qualifier_kind: "qualifier", status: "unknown" },
      { qualifier_key: "b", qualifier_kind: "disqualifier", status: "failed" },
    ]);
    expect(r.status).toBe("not_eligible");
  });
});

describe("resolveEligibilityFromRows (stored eligibility_checks rows)", () => {
  it("maps stored statuses used by the staff review surface", () => {
    expect(
      resolveEligibilityFromRows([
        { qualifier_key: "license", qualifier_kind: "qualifier", status: "eligible" },
      ]).status,
    ).toBe("eligible");

    expect(
      resolveEligibilityFromRows([
        { qualifier_key: "work_auth", qualifier_kind: "disqualifier", status: "not_eligible" },
      ]).status,
    ).toBe("not_eligible");

    expect(
      resolveEligibilityFromRows([
        { qualifier_key: "license", qualifier_kind: "qualifier", status: "needs_validation" },
      ]).status,
    ).toBe("needs_validation");

    expect(
      resolveEligibilityFromRows([
        { qualifier_key: "work_auth", qualifier_kind: "disqualifier", status: "excepted" },
      ]).status,
    ).toBe("excepted");
  });

  it("treats not_evaluated as undecided, never as a pass", () => {
    const r = resolveEligibilityFromRows([
      { qualifier_key: "license", qualifier_kind: "qualifier", status: "not_evaluated" },
    ]);
    expect(r.status).toBe("needs_validation");
    expect(r.unknown_checks).toHaveLength(1);
  });

  it("no stored checks resolves to eligible", () => {
    expect(resolveEligibilityFromRows([]).status).toBe("eligible");
    expect(resolveEligibilityFromRows(null).status).toBe("eligible");
  });
});

describe("deriveRecommendation", () => {
  it("high score + not_eligible -> do_not_recommend (fit does NOT override eligibility)", () => {
    const r = deriveRecommendation({
      eligibility: "not_eligible",
      fit_score: 97,
      evidence_confidence: 90,
    });
    expect(r.status).toBe("do_not_recommend");
  });

  it("needs_validation -> hold_for_validation regardless of fit", () => {
    const r = deriveRecommendation({
      eligibility: "needs_validation",
      fit_score: 92,
      evidence_confidence: 85,
    });
    expect(r.status).toBe("hold_for_validation");
  });

  it("high fit + high confidence + eligible -> shortlist", () => {
    const r = deriveRecommendation({
      eligibility: "eligible",
      fit_score: 90,
      evidence_confidence: 88,
    });
    expect(r.status).toBe("shortlist");
  });

  it("strong fit with LOW confidence -> review, not shortlist", () => {
    const r = deriveRecommendation({
      eligibility: "eligible",
      fit_score: 78,
      evidence_confidence: 35,
    });
    expect(r.status).toBe("review");
  });

  it("pending when no fit yet", () => {
    const r = deriveRecommendation({
      eligibility: "eligible",
      fit_score: null,
      evidence_confidence: null,
    });
    expect(r.status).toBe("pending");
  });
});

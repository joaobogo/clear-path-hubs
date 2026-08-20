import { describe, expect, it } from "vitest";
import { reconcileOfferWithStage, stageMeansHired } from "@/lib/offer-hire-stage";
import { qualifiesAsHire } from "@/lib/offer-hire";

describe("offer status reconciliation against candidate stage", () => {
  it("treats a hired candidate as a confirmed hire even when the offer says closed lost", () => {
    const row = reconcileOfferWithStage(
      { status: "closed_lost", close_reason: "candidate_declined", close_reason_notes: "x" },
      "hired",
    );
    expect(row.status).toBe("hire_confirmed");
    expect(row.close_reason).toBeNull();
    expect(row.close_reason_notes).toBeNull();
    expect(qualifiesAsHire(row.status)).toBe(true);
  });

  it("leaves offers alone when the candidate is not hired", () => {
    const row = reconcileOfferWithStage({ status: "offer_sent" }, "interview_process");
    expect(row.status).toBe("offer_sent");
    expect(row.stage_reconciled).toBeUndefined();
  });

  it("recognises only the hired stage", () => {
    expect(stageMeansHired("hired")).toBe(true);
    expect(stageMeansHired("offer")).toBe(false);
    expect(stageMeansHired(null)).toBe(false);
  });
});

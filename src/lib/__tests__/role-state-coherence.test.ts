import { describe, it, expect } from "vitest";
import { computeClientRoleStatus } from "../client-role-status";

describe("Role State Coherence", () => {
  it("shows Offer Out even if status is closed but an offer is active", () => {
    const status = computeClientRoleStatus({
      status: "closed",
      hires: 1,
      offers: 1, // Contradiction: closed but has offer
      interviewing: 0,
      shortlisted: 0,
      delivered: 0
    });
    expect(status.key).toBe("offer_out");
  });

  it("shows Hired for a closed role with a hire and no active pipeline", () => {
    const status = computeClientRoleStatus({
      status: "closed",
      hires: 1,
      offers: 0,
      interviewing: 0,
      shortlisted: 0,
      delivered: 0
    });
    expect(status.key).toBe("hired");
  });

  it("shows Closed for a closed role with no hires and no pipeline", () => {
    const status = computeClientRoleStatus({
      status: "closed",
      hires: 0,
      offers: 0,
      interviewing: 0,
      shortlisted: 0,
      delivered: 0
    });
    expect(status.key).toBe("closed");
  });
});

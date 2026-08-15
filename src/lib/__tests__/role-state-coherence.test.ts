import { describe, it, expect } from "vitest";
import { computeClientRoleStatus } from "../client-role-status";
import { countRolesByTab } from "../client-role-status-tabs";

describe("Role State Coherence", () => {
  it("keeps a role Active when an offer remains open", () => {
    const status = computeClientRoleStatus({
      status: "closed",
      hires: 1,
      offers: 1, // Contradiction: closed but has offer
      interviewing: 0,
      shortlisted: 0,
      delivered: 0
    });
    expect(status.key).toBe("active");
  });

  it("shows Closed for a filled role with a hire and no active pipeline", () => {
    const status = computeClientRoleStatus({
      status: "closed",
      hires: 1,
      offers: 0,
      interviewing: 0,
      shortlisted: 0,
      delivered: 0
    });
    expect(status.key).toBe("closed");
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

  it("keeps booked interviews and pending decisions out of Archived", () => {
    expect(computeClientRoleStatus({ status: "filled", hires: 1, interviewing: 2 }).key).toBe("active");
    expect(computeClientRoleStatus({ status: "closed", hires: 1, delivered: 1 }).key).toBe("active");
  });

  it("uses lifecycle labels rather than candidate stages", () => {
    expect(computeClientRoleStatus({ status: "active", hires: 1, offers: 1 }).label).toBe("Active");
    expect(computeClientRoleStatus({ status: "under_review" }).label).toBe("Under review");
  });

  it("archives only roles whose canonical lifecycle is Closed", () => {
    const counts = countRolesByTab([
      { client_status: computeClientRoleStatus({ status: "filled", hires: 1 }) },
      { client_status: computeClientRoleStatus({ status: "filled", hires: 1, offers: 1 }) },
      { client_status: computeClientRoleStatus({ status: "paused" }) },
      { client_status: computeClientRoleStatus({ status: "under_review" }) },
    ]);

    expect(counts).toEqual({ active: 1, draft: 1, paused: 1, closed: 1 });
  });
});

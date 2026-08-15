import { describe, expect, it } from "vitest";
import {
  CLIENT_ROLE_STATUS_UNAVAILABLE,
  clientRoleStatusLabel,
  computeClientRoleStatus,
} from "../client-role-status";

const label = (i: Parameters<typeof computeClientRoleStatus>[0]) =>
  computeClientRoleStatus(i).label;

describe("computeClientRoleStatus", () => {
  it("paused wins while unresolved work prevents a false closed state", () => {
    expect(label({ status: "paused", offers: 3, interviewing: 2 })).toBe("Paused");
    expect(label({ status: "archived", shortlisted: 5 })).toBe("Active");
    expect(label({ status: "closed", delivered: 2 })).toBe("Active");
  });

  it("never presents a candidate stage as the role status", () => {
    expect(label({ status: "active", hires: 1, offers: 2, interviewing: 3 })).toBe("Active");
    expect(label({ status: "filled", hires: 1 })).toBe("Closed");
  });

  it("uses Active for every live-search pipeline milestone", () => {
    expect(label({ status: "active", offers: 1, interviewing: 4 })).toBe("Active");
    expect(label({ status: "active", interviewing: 1, shortlisted: 4 })).toBe("Active");
    expect(label({ status: "active", delivered: 3 })).toBe("Active");
    expect(label({ status: "active" })).toBe("Active");
  });

  it("shows Under review before the search goes live", () => {
    for (const s of ["draft", "submitted", "under_review", "needs_clarification"]) {
      expect(label({ status: s })).toBe("Under review");
    }
  });

  it("renders Under review for unmapped internal values, never the raw value", () => {
    expect(label({ status: "weird_internal_state" })).toBe("Under review");
    expect(label({ status: null })).toBe("Under review");
    expect(label({ status: "" })).toBe("Under review");
  });

  it("falls back to Status unavailable, not Sourcing", () => {
    expect(clientRoleStatusLabel(null)).toBe(CLIENT_ROLE_STATUS_UNAVAILABLE);
    expect(clientRoleStatusLabel(undefined)).toBe(CLIENT_ROLE_STATUS_UNAVAILABLE);
  });
});

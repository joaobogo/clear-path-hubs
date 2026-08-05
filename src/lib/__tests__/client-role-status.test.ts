import { describe, expect, it } from "vitest";
import {
  CLIENT_ROLE_STATUS_UNAVAILABLE,
  clientRoleStatusLabel,
  computeClientRoleStatus,
} from "../client-role-status";

const label = (i: Parameters<typeof computeClientRoleStatus>[0]) =>
  computeClientRoleStatus(i).label;

describe("computeClientRoleStatus", () => {
  it("paused and closed always win over pipeline activity", () => {
    expect(label({ status: "paused", offers: 3, interviewing: 2 })).toBe("Paused");
    expect(label({ status: "archived", shortlisted: 5 })).toBe("Closed");
    expect(label({ status: "closed", delivered: 2 })).toBe("Closed");
  });

  it("hired beats offer, interview and shortlist", () => {
    expect(label({ status: "active", hires: 1, offers: 2, interviewing: 3 })).toBe("Hired");
    expect(label({ status: "filled", hires: 1 })).toBe("Hired");
  });

  it("derives by furthest meaningful stage", () => {
    expect(label({ status: "active", offers: 1, interviewing: 4 })).toBe("Offer out");
    expect(label({ status: "active", interviewing: 1, shortlisted: 4 })).toBe("Interviewing");
    expect(label({ status: "active", shortlisted: 2 })).toBe("Shortlist ready for you");
    expect(label({ status: "active", delivered: 3 })).toBe("Shortlist ready for you");
    expect(label({ status: "active" })).toBe("Sourcing");
  });

  it("shows Setting up before the search goes live", () => {
    for (const s of ["draft", "submitted", "under_review", "needs_clarification"]) {
      expect(label({ status: s })).toBe("Setting up");
    }
  });

  it("renders In progress for unmapped internal values, never the raw value", () => {
    expect(label({ status: "weird_internal_state" })).toBe("In progress");
    expect(label({ status: null })).toBe("In progress");
    expect(label({ status: "" })).toBe("In progress");
  });

  it("falls back to Status unavailable, not Sourcing", () => {
    expect(clientRoleStatusLabel(null)).toBe(CLIENT_ROLE_STATUS_UNAVAILABLE);
    expect(clientRoleStatusLabel(undefined)).toBe(CLIENT_ROLE_STATUS_UNAVAILABLE);
  });
});

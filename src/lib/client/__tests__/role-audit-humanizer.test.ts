import { describe, it, expect } from "vitest";
import { humanizeRoleAction } from "../role-audit-humanizer";

describe("Role Audit Humanizer", () => {
  it("maps raw lifecycle events to friendly labels", () => {
    expect(humanizeRoleAction("position.create")).toBe("Role created");
    expect(humanizeRoleAction("position.submit")).toBe("Role submitted for review");
    expect(humanizeRoleAction("position.start_review")).toBe("TaaSFlow started reviewing your role");
  });

  it("maps update events to friendly labels", () => {
    expect(humanizeRoleAction("position.edit_wizard")).toBe("Role details updated");
    expect(humanizeRoleAction("position.requisition_updated")).toBe("Role details updated");
  });

  it("handles space-cased inputs from older events", () => {
    expect(humanizeRoleAction("position start review")).toBe("TaaSFlow started reviewing your role");
    expect(humanizeRoleAction("position create")).toBe("Role created");
  });

  it("falls back to a generic friendly label for unknown keys", () => {
    expect(humanizeRoleAction("some_internal_secret_event")).toBe("Role activity recorded");
    expect(humanizeRoleAction("unknown.action")).toBe("Role activity recorded");
  });

  it("never returns the raw key for unknown events", () => {
    const unknownKey = "internal_debug_key_999";
    const result = humanizeRoleAction(unknownKey);
    expect(result).not.toBe(unknownKey);
    expect(result).not.toContain("internal");
  });
});

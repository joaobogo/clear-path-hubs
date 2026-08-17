import { describe, it, expect } from "vitest";
import { sanitizeInternalMarkers } from "./human-labels";
import { humanizePublishBlockedMessage, PUBLISH_BLOCKED_PREFIX } from "./publish-gate";

describe("MVP Fixes Sanitization (P-012, P-036)", () => {
  it("strips TAASFLOW_DEMO_SEED", () => {
    expect(sanitizeInternalMarkers("TAASFLOW_DEMO_SEED: User reason")).toBe("User reason");
    expect(sanitizeInternalMarkers("Just a seed TAASFLOW_DEMO_SEED here")).toBe("Just a seed");
  });

  it("strips trace IDs", () => {
    expect(sanitizeInternalMarkers("Trace pl_abcdef1234567890 occurred")).toBe("Trace");
    expect(sanitizeInternalMarkers("Support sv_12345678abc session")).toBe("Support session");
  });

  it("strips UUIDs", () => {
    expect(sanitizeInternalMarkers("Actor 550e8400-e29b-41d4-a716-446655440000 did this")).toBe("Actor did this");
  });
});

describe("MVP Fixes Humanization (P-019)", () => {
  it("humanizes missing requirements block", () => {
    const raw = `${PUBLISH_BLOCKED_PREFIX}At least one requirement is needed to score candidates. Resolve these first — publishing is not bypassable.`;
    expect(humanizePublishBlockedMessage(raw)).toBe("Approval blocked: add at least one must-have requirement");
  });

  it("humanizes payment block", () => {
    const raw = `${PUBLISH_BLOCKED_PREFIX}Payment not complete. Resolve these first — publishing is not bypassable.`;
    expect(humanizePublishBlockedMessage(raw)).toBe("Approval blocked: payment or exemption required");
  });
});

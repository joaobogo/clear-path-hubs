import { describe, it, expect } from "vitest";
import { blueprintStageIndex, BLUEPRINT_STAGES } from "./express-intake-schema";

describe("blueprintStageIndex", () => {
  it("should return -1 for failed status", () => {
    expect(blueprintStageIndex("failed")).toBe(-1);
  });

  it("should return the length for ready status", () => {
    expect(blueprintStageIndex("ready")).toBe(BLUEPRINT_STAGES.length);
  });

  it("should derive 'Role created' (index 0) if position exists but no progress", () => {
    const pos = { created_at: "2026-08-14T02:48:00Z", status: "draft" };
    expect(blueprintStageIndex("queued", pos)).toBe(0);
  });

  it("should derive 'Reading job description' (index 1) if submitted", () => {
    const pos = { submitted_at: "2026-08-14T02:50:00Z", status: "draft" };
    expect(blueprintStageIndex("queued", pos)).toBe(1);
  });

  it("should derive 'Building blueprint' (index 3) if under review", () => {
    const pos = { status: "under_review" };
    expect(blueprintStageIndex("queued", pos)).toBe(3);
  });

  it("should return full progress if active", () => {
    const pos = { status: "active" };
    expect(blueprintStageIndex("queued", pos)).toBe(BLUEPRINT_STAGES.length);
  });

  it("should favor the explicit status field if it is more advanced than derived", () => {
    const pos = { created_at: "2026-08-14T02:48:00Z", status: "draft" };
    // Explicit status is researching_company (index 2)
    expect(blueprintStageIndex("researching_company", pos)).toBe(2);
  });
});

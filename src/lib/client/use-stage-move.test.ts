import { describe, expect, it } from "vitest";
import { applyOptimisticStage, stageMoveErrorMessage } from "./use-stage-move";

describe("stageMoveErrorMessage", () => {
  const msg = (raw: string) => stageMoveErrorMessage(new Error(raw));

  it("keeps the wording the role board has always shown", () => {
    expect(msg("invalid_transition: delivered -> hired")).toBe(
      "That move is not allowed for this stage.",
    );
    expect(msg("reason_required")).toBe(
      "A reason is required to mark a candidate as not moving forward.",
    );
    expect(msg("SUPPORT_VIEW_READ_ONLY")).toBe(
      "Unavailable while viewing this workspace in read-only support mode.",
    );
    expect(msg("forbidden")).toBe("You do not have permission to move candidates.");
    expect(msg("match_not_visible")).toBe("This candidate is no longer available.");
  });

  it("strips the Error prefix and passes unknown failures through", () => {
    expect(msg("Error: something specific from the server")).toBe(
      "something specific from the server",
    );
  });
});

describe("applyOptimisticStage", () => {
  const rows = [
    { id: "a", stage: "delivered" },
    { id: "b", stage: "shortlisted" },
  ];

  it("moves only the grabbed card and preserves order", () => {
    const next = applyOptimisticStage(rows, "b", "interview_process");
    expect(next.map((r) => r.id)).toEqual(["a", "b"]);
    expect(next[1].stage).toBe("interview_process");
    expect(next[0]).toBe(rows[0]);
    // The snapshot the rollback restores must not be mutated.
    expect(rows[1].stage).toBe("shortlisted");
  });
});

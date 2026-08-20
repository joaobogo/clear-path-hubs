import { describe, expect, it } from "vitest";
import { isActiveInterview } from "@/lib/interview-state";

const NOW = Date.parse("2026-08-20T12:00:00.000Z");

describe("isActiveInterview", () => {
  it("treats a requested interview with future proposed times as active", () => {
    expect(
      isActiveInterview(
        { status: "requested", proposed_times: ["2026-08-22T14:00:00.000Z"] },
        NOW,
      ),
    ).toBe(true);
  });

  it("does not treat cancelled, completed, empty, or expired requests as active", () => {
    expect(isActiveInterview({ status: "cancelled" }, NOW)).toBe(false);
    expect(isActiveInterview({ status: "completed" }, NOW)).toBe(false);
    expect(isActiveInterview({ status: "requested", proposed_times: [] }, NOW)).toBe(false);
    expect(
      isActiveInterview(
        {
          status: "scheduling",
          proposed_times: ["2026-08-22T14:00:00.000Z"],
          availability_expires_at: "2026-08-19T14:00:00.000Z",
        },
        NOW,
      ),
    ).toBe(false);
  });

  it("keeps scheduled interviews active until completed or cancelled", () => {
    expect(
      isActiveInterview({ status: "scheduled", scheduled_at: "2026-08-18T14:00:00.000Z" }, NOW),
    ).toBe(true);
  });
});
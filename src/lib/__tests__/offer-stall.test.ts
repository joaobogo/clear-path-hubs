import { describe, it, expect } from "vitest";
import { isStalled, stallLabel, hoursSinceMovement, stageEnteredAt } from "../offer-stall";

const now = new Date("2026-07-30T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

describe("offer stall detection", () => {
  it("flags a sent offer with no movement for 48h", () => {
    expect(isStalled({ status: "offer_sent", sent_at: hoursAgo(50) }, now)).toBe(true);
  });

  it("does not flag a fresh offer", () => {
    expect(isStalled({ status: "offer_sent", sent_at: hoursAgo(10) }, now)).toBe(false);
  });

  it("resets the clock after a nudge", () => {
    expect(
      isStalled(
        { status: "offer_negotiating", negotiating_at: hoursAgo(100), last_nudged_at: hoursAgo(2) },
        now,
      ),
    ).toBe(false);
  });

  it("never flags closed records", () => {
    expect(isStalled({ status: "hire_confirmed", updated_at: hoursAgo(500) }, now)).toBe(false);
    expect(isStalled({ status: "offer_declined", updated_at: hoursAgo(500) }, now)).toBe(false);
  });

  it("reads stage entry per status", () => {
    expect(
      stageEnteredAt({ status: "offer_accepted", accepted_at: "x", sent_at: "y" }),
    ).toBe("x");
  });

  it("labels the delay in days past 48h", () => {
    expect(stallLabel({ status: "offer_sent", sent_at: hoursAgo(72) }, now)).toBe(
      "no movement for 3 days",
    );
  });

  it("returns null hours when nothing is known", () => {
    expect(hoursSinceMovement({ status: "offer_sent" }, now)).toBeNull();
  });
});

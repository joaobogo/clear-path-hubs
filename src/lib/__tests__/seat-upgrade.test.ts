import { describe, expect, it } from "vitest";
import {
  hasSeatContext,
  parseSeatUpgradeSearch,
  planResolvesSeatNeed,
  planTotalSeats,
  seatContextSummary,
  seatShortfall,
  seatUpgradeSearch,
} from "@/lib/seat-upgrade";

describe("seatUpgradeSearch", () => {
  it("carries the counts the team tab knows", () => {
    expect(
      seatUpgradeSearch({ seatsUsed: 4, seatLimit: 4, pendingInvites: 1, activeMembers: 3 }, 1),
    ).toEqual({ seatsUsed: 4, seatLimit: 4, seatsPending: 1, seatsNeeded: 1 });
  });

  it("always asks for at least one seat and omits unknown counts", () => {
    expect(seatUpgradeSearch(undefined, 0)).toEqual({ seatsNeeded: 1 });
  });
});

describe("parseSeatUpgradeSearch", () => {
  it("keeps valid numbers and drops junk", () => {
    expect(
      parseSeatUpgradeSearch({ seatsUsed: "4", seatLimit: 4, seatsNeeded: "x", seatsPending: -2 }),
    ).toEqual({ seatsUsed: 4, seatLimit: 4 });
  });
});

describe("seatShortfall", () => {
  it("subtracts free seats from the ask", () => {
    expect(seatShortfall({ seatsUsed: 3, seatLimit: 4, seatsNeeded: 2 })).toBe(1);
    expect(seatShortfall({ seatsUsed: 4, seatLimit: 4, seatsNeeded: 1 })).toBe(1);
    expect(seatShortfall({ seatsUsed: 2, seatLimit: 4, seatsNeeded: 1 })).toBe(0);
  });

  it("falls back to the raw ask when usage is unknown", () => {
    expect(seatShortfall({ seatsNeeded: 2 })).toBe(2);
  });
});

describe("plan seat capacity", () => {
  it("adds the owner seat to the recruiter allowance", () => {
    expect(planTotalSeats("pilot")).toBe(2);
    expect(planTotalSeats("subscription_bronze")).toBe(4);
    expect(planTotalSeats("subscription_gold")).toBe(11);
    expect(planTotalSeats("unknown_product")).toBeNull();
  });

  it("only marks a plan as resolving when it covers the whole ask", () => {
    const ctx = { seatsUsed: 4, seatLimit: 4, seatsNeeded: 1 };
    expect(planResolvesSeatNeed(4, ctx)).toBe(false);
    expect(planResolvesSeatNeed(6, ctx)).toBe(true);
    expect(planResolvesSeatNeed(null, ctx)).toBe(false);
  });
});

describe("seatContextSummary", () => {
  it("states usage, pending invites and the ask", () => {
    expect(
      seatContextSummary({ seatsUsed: 4, seatLimit: 4, seatsPending: 1, seatsNeeded: 1 }),
    ).toBe(
      "You are using 4 of 4 seats, including 1 pending invitation, and the action you tried needs 1 more seat.",
    );
  });

  it("degrades gracefully with no counts", () => {
    expect(seatContextSummary({ seatsNeeded: 2 })).toBe(
      "The action you tried needs 2 more seats than your plan currently allows.",
    );
  });

  it("requires an explicit ask before showing seat context", () => {
    expect(hasSeatContext({ seatsUsed: 4 })).toBe(false);
    expect(hasSeatContext({ seatsNeeded: 1 })).toBe(true);
  });
});

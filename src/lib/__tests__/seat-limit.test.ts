import { describe, expect, it } from "vitest";
import {
  SEAT_LIMIT_DB_CODE,
  isSeatLimitError,
  seatAwareErrorMessage,
  seatLimitMessage,
} from "@/lib/seat-limit";

// The point of these tests: a client must never read Postgres trigger text, and
// every seat refusal — whichever layer raised it — must end in the same
// actionable prompt.
describe("seat limit recognition", () => {
  it("recognises the database guard's check_violation text", () => {
    const dbError = new Error(
      `${SEAT_LIMIT_DB_CODE}: organization allows 1 owner seat plus 3 recruiter seats`,
    );
    expect(isSeatLimitError(dbError)).toBe(true);
  });

  it("recognises the friendly server-side refusal", () => {
    expect(
      isSeatLimitError(
        new Error("Seat limit reached — your plan includes 4 seats and all 4 are in use"),
      ),
    ).toBe(true);
  });

  it("does not misread unrelated failures as seat problems", () => {
    expect(isSeatLimitError(new Error("You need at least one active Admin"))).toBe(false);
    expect(isSeatLimitError(new Error("Network request failed"))).toBe(false);
    expect(isSeatLimitError(null)).toBe(false);
  });
});

describe("seat limit messaging", () => {
  it("names the plan's seat count when known", () => {
    const msg = seatLimitMessage({ seatsUsed: 4, seatLimit: 4 });
    expect(msg).toContain("all 4 seats");
    expect(msg).toContain("pending invitation");
  });

  it("stays coherent when seat usage is unknown", () => {
    expect(seatLimitMessage()).toContain("every seat on your plan is in use");
  });

  it("always offers a way forward", () => {
    expect(seatLimitMessage({ seatsUsed: 4, seatLimit: 4 })).toMatch(/talk to us about your plan/i);
  });

  it("replaces raw trigger text rather than showing it", () => {
    const dbError = new Error(
      `${SEAT_LIMIT_DB_CODE}: organization allows 1 owner seat plus 3 recruiter seats`,
    );
    const shown = seatAwareErrorMessage(dbError, { seatsUsed: 4, seatLimit: 4 });
    expect(shown).not.toContain(SEAT_LIMIT_DB_CODE);
    expect(shown).not.toMatch(/recruiter seats/);
    expect(shown).toContain("seat limit");
  });

  it("passes non-seat failures through unchanged", () => {
    expect(
      seatAwareErrorMessage(new Error("Error: That person is already on this team.")),
    ).toBe("That person is already on this team.");
  });

  it("falls back rather than showing an empty toast", () => {
    expect(seatAwareErrorMessage(new Error(""), undefined, "Could not invite.")).toBe(
      "Could not invite.",
    );
  });
});

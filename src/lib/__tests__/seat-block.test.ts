import { describe, expect, it } from "vitest";
import { isSeatBlocked, seatBlockCode, seatBlockReason } from "@/lib/seat-limit";

describe("seatBlockCode", () => {
  it("flags pending invitations when any are outstanding", () => {
    expect(seatBlockCode({ seatLimit: 4, seatsUsed: 4, pendingInvites: 1, activeMembers: 3 })).toBe(
      "pending_invites_hold_seats",
    );
  });

  it("says every seat is active when no invitation is pending", () => {
    expect(seatBlockCode({ seatLimit: 4, seatsUsed: 4, pendingInvites: 0, activeMembers: 4 })).toBe(
      "all_seats_active",
    );
  });

  it("falls back to the generic code when composition is unknown", () => {
    expect(seatBlockCode({ seatLimit: 4, seatsUsed: 4 })).toBe("seat_limit_reached");
  });
});

describe("seatBlockReason", () => {
  it("quotes the pending invitation count", () => {
    const text = seatBlockReason({
      code: "pending_invites_hold_seats",
      usage: { seatLimit: 4, seatsUsed: 4, pendingInvites: 2 },
    });
    expect(text).toContain("4 of 4 seats are in use");
    expect(text).toContain("2 pending invitations");
  });

  it("uses singular wording for one invitation", () => {
    expect(
      seatBlockReason({
        code: "pending_invites_hold_seats",
        usage: { seatLimit: 4, seatsUsed: 4, pendingInvites: 1 },
      }),
    ).toContain("1 pending invitation still holds a seat");
  });

  it("explains an all-active workspace", () => {
    expect(
      seatBlockReason({
        code: "all_seats_active",
        usage: { seatLimit: 6, seatsUsed: 6, pendingInvites: 0 },
      }),
    ).toContain("every one belongs to an active teammate");
  });

  it("stays generic without counts", () => {
    expect(seatBlockReason({ code: "seat_limit_reached", usage: {} })).toContain(
      "every seat on your plan is in use",
    );
  });
});

describe("isSeatBlocked", () => {
  it("narrows a structured refusal", () => {
    expect(isSeatBlocked({ ok: false, seatBlock: { code: "all_seats_active", usage: {} } })).toBe(
      true,
    );
  });

  it("ignores successes and junk", () => {
    expect(isSeatBlocked({ ok: true })).toBe(false);
    expect(isSeatBlocked(null)).toBe(false);
    expect(isSeatBlocked({ ok: false })).toBe(false);
  });
});

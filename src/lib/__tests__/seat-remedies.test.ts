import { describe, expect, it } from "vitest";
import { seatFreeRemedies } from "@/lib/seat-limit";

/**
 * The blocked-reactivation dialog must only offer remedies the workspace can
 * actually act on. Advice pointing at a pending invitation that does not exist,
 * or at a teammate to suspend when the admin is alone, reads as a dead end.
 */
const ids = (usage?: Parameters<typeof seatFreeRemedies>[0]) =>
  seatFreeRemedies(usage).map((r) => r.id);

describe("seat remedies per seat-holding scenario", () => {
  it("offers cancelling an invite when invitations hold seats", () => {
    const remedies = seatFreeRemedies({ seatsUsed: 4, seatLimit: 4, pendingInvites: 2, activeMembers: 2 });
    const invite = remedies.find((r) => r.id === "cancel_invite");
    expect(invite?.text).toContain("2 pending invitations");
    expect(invite?.actionLabel).toBe("Cancel a pending invitation");
  });

  it("uses the singular when exactly one invitation holds a seat", () => {
    const invite = seatFreeRemedies({ pendingInvites: 1, activeMembers: 3 }).find(
      (r) => r.id === "cancel_invite",
    );
    expect(invite?.text).toContain("1 pending invitation —");
  });

  it("drops the invite remedy when every seat is held by an active teammate", () => {
    expect(ids({ seatsUsed: 4, seatLimit: 4, pendingInvites: 0, activeMembers: 4 })).toEqual([
      "suspend_active",
      "remove_member",
      "add_seats",
    ]);
  });

  it("drops the suspend remedy when the admin is the only active member", () => {
    // Seats held by invitations only: there is nobody else to suspend.
    expect(ids({ seatsUsed: 4, seatLimit: 4, pendingInvites: 3, activeMembers: 1 })).toEqual([
      "cancel_invite",
      "remove_member",
      "add_seats",
    ]);
  });

  it("offers both when seats are split between invites and teammates", () => {
    expect(ids({ seatsUsed: 4, seatLimit: 4, pendingInvites: 1, activeMembers: 3 })).toEqual([
      "cancel_invite",
      "suspend_active",
      "remove_member",
      "add_seats",
    ]);
  });

  it("falls back to generic wording when seat composition is unknown", () => {
    const remedies = seatFreeRemedies();
    expect(remedies.map((r) => r.id)).toEqual([
      "cancel_invite",
      "suspend_active",
      "remove_member",
      "add_seats",
    ]);
    // No counts to quote, so the invite line carries no number and no jump button.
    const invite = remedies[0]!;
    expect(invite.text).not.toMatch(/\d/);
    expect(invite.actionLabel).toBeUndefined();
  });

  it("always ends with a way forward that does not depend on other members", () => {
    for (const usage of [
      { pendingInvites: 0, activeMembers: 1 },
      { pendingInvites: 0, activeMembers: 9 },
      { pendingInvites: 4, activeMembers: 1 },
    ]) {
      const list = ids(usage);
      expect(list).toContain("remove_member");
      expect(list.at(-1)).toBe("add_seats");
    }
  });

  it("only attaches jump actions to remedies that have a target", () => {
    for (const remedy of seatFreeRemedies({ pendingInvites: 2, activeMembers: 3 })) {
      if (remedy.id === "cancel_invite" || remedy.id === "suspend_active") {
        expect(remedy.actionLabel).toBeTruthy();
      } else {
        expect(remedy.actionLabel).toBeUndefined();
      }
    }
  });
});

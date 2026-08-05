import { describe, expect, it } from "vitest";
import {
  COMMITMENT_PENDING_MESSAGE,
  buildDeliveryCommitment,
  firstShortlistDate,
} from "../delivery-commitment";

const row = {
  position_id: "pos-1",
  first_shortlist_days: 5,
  shortlist_size: 3,
  interview_slots_hours: 24,
  baseline_at: "2026-01-01T00:00:00.000Z",
};

describe("delivery commitment", () => {
  it("derives the shortlist date from the stored baseline", () => {
    expect(firstShortlistDate(row)).toBe("2026-01-06T00:00:00.000Z");
  });

  it("states the commitment when a row is attached to the role", () => {
    const c = buildDeliveryCommitment({ commitment: row, positionId: "pos-1", contactName: "Dana" });
    expect(c.hasCommitment).toBe(true);
    expect(c.rows.map((r) => r.value)).toEqual([
      expect.any(String),
      "3 candidates",
      "1 working day",
    ]);
    expect(c.clientTurnaround).toContain("1 working day");
    expect(c.contactLine).toContain("Dana");
    expect(c.pendingMessage).toBeNull();
  });

  it("shows no dates when nothing is committed", () => {
    const c = buildDeliveryCommitment({ commitment: null, positionId: "pos-1", contactName: null });
    expect(c.hasCommitment).toBe(false);
    expect(c.firstShortlistBy).toBeNull();
    expect(c.rows).toEqual([]);
    expect(c.pendingMessage).toBe(COMMITMENT_PENDING_MESSAGE);
    expect(c.contactLine).toContain("introduced by email");
  });

  it("refuses a commitment row belonging to another role", () => {
    const c = buildDeliveryCommitment({ commitment: row, positionId: "pos-2", contactName: null });
    expect(c.hasCommitment).toBe(false);
  });

  it("refuses an unusable baseline", () => {
    const c = buildDeliveryCommitment({
      commitment: { ...row, baseline_at: "not-a-date" },
      positionId: "pos-1",
      contactName: null,
    });
    expect(c.hasCommitment).toBe(false);
  });
});

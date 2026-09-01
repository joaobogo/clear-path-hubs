/**
 * One broken integration is one item of work, not 150.
 *
 * 150 of the 187 items on the admin work queue were the same internal Teams
 * webhook failing — the same candidate appearing more than once — and every
 * genuine item (1 approval, 8 decisions, 7 overdue clients, 3 interviews) was
 * numerically drowned by it. The tile's own description promises failures
 * "where a retry can still get through", and retrying a webhook 150 times will
 * not fix a webhook (audit 1 Sep, F10 and F28).
 *
 * loadDeliveryFailures already grouped these — summary.systemicFailures is one
 * entry per (channel, reason) with 5+ rows in the window, and
 * /admin/notifications was reading it. The work queue was not.
 *
 * This tests the grouping shape the desk applies, kept here as a pure function
 * so it can be exercised without a database.
 */
import { describe, expect, it } from "vitest";

type Row = { id: string; channel: string; reason: string; lastAttemptAt: string };
type Group = { channel: string; reason: string };

/** The reduction the desk performs. Mirrors admin-ops.server.ts. */
function collapse(rows: Row[], systemic: Group[]) {
  const isSystemic = (r: Row) =>
    systemic.some((g) => g.channel === r.channel && g.reason === r.reason);
  const individual = rows.filter((r) => !isSystemic(r));
  const grouped = systemic.map((g) => ({
    ...g,
    occurrences: rows.filter((r) => r.channel === g.channel && r.reason === g.reason).length,
  }));
  return { grouped, individual, workItems: grouped.length + individual.length };
}

const webhook = (i: number): Row => ({
  id: `w${i}`,
  channel: "teams",
  reason: "webhook_unreachable",
  lastAttemptAt: `2026-08-28T10:${String(i).padStart(2, "0")}:00.000Z`,
});

describe("collapsing a systemic failure", () => {
  const rows = [
    ...Array.from({ length: 150 }, (_, i) => webhook(i)),
    { id: "e1", channel: "email", reason: "mailbox_full", lastAttemptAt: "2026-08-29T10:00:00Z" },
    { id: "e2", channel: "email", reason: "greylisted", lastAttemptAt: "2026-08-29T11:00:00Z" },
  ];
  const systemic = [{ channel: "teams", reason: "webhook_unreachable" }];

  it("counts one integration as one item of work", () => {
    const { workItems } = collapse(rows, systemic);
    expect(workItems).toBe(3); // one webhook cause + two individual emails
    expect(workItems).not.toBe(rows.length);
  });

  it("keeps the raw count available for the badge", () => {
    const { grouped } = collapse(rows, systemic);
    expect(grouped[0]!.occurrences).toBe(150);
  });

  it("does not swallow the genuine individual failures", () => {
    const { individual } = collapse(rows, systemic);
    expect(individual.map((r) => r.id).sort()).toEqual(["e1", "e2"]);
  });

  it("leaves everything alone when nothing is systemic", () => {
    const { grouped, individual, workItems } = collapse(rows, []);
    expect(grouped).toEqual([]);
    expect(individual).toHaveLength(rows.length);
    expect(workItems).toBe(rows.length);
  });

  it("groups by channel AND reason, not by channel alone", () => {
    // Two different failures on one channel are two problems.
    const mixed = [
      webhook(1),
      webhook(2),
      { id: "t3", channel: "teams", reason: "rate_limited", lastAttemptAt: "2026-08-29T10:00:00Z" },
    ];
    const { grouped, individual } = collapse(mixed, systemic);
    expect(grouped[0]!.occurrences).toBe(2);
    expect(individual.map((r) => r.id)).toEqual(["t3"]);
  });
});

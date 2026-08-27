import { describe, expect, it } from "vitest";
import { dedupeDecisions } from "../dedupe";

const match = "m1";

function row(decision: string, minutesAgo: number, feedback: string | null = null) {
  return {
    id: `${decision}:${minutesAgo}`,
    candidate_match_id: match,
    decision,
    feedback,
    created_at: new Date(Date.UTC(2026, 7, 21, 9, 0) + minutesAgo * 60_000).toISOString(),
  };
}

describe("dedupeDecisions", () => {
  it("collapses a burst of identical decisions into one entry", () => {
    const rows = [row("shortlist", 0), row("shortlist", 0), row("shortlist", 1)];
    expect(dedupeDecisions(rows)).toHaveLength(1);
  });

  it("collapses an alternating burst written in the same minutes", () => {
    const rows = [
      row("shortlist", 0),
      row("not_moving_forward", 0),
      row("shortlist", 1),
      row("not_moving_forward", 1),
      row("shortlist", 2),
      row("not_moving_forward", 2),
    ];
    expect(dedupeDecisions(rows).map((r) => r.decision)).toEqual([
      "shortlist",
      "not_moving_forward",
    ]);
  });

  it("keeps a genuine change of mind recorded later", () => {
    const rows = [
      row("shortlist", 0),
      row("not_moving_forward", 60),
      row("shortlist", 240),
    ];
    expect(dedupeDecisions(rows)).toHaveLength(3);
  });

  it("keeps decisions on different candidates apart", () => {
    const rows = [
      { ...row("shortlist", 0), candidate_match_id: "a" },
      { ...row("shortlist", 0), candidate_match_id: "b" },
    ];
    expect(dedupeDecisions(rows)).toHaveLength(2);
  });

  it("works on audit-event shaped rows and preserves input order", () => {
    const rows = [
      { id: "2", action: "client.shortlist", entity_id: "a", created_at: "2026-08-21T09:05:00Z" },
      { id: "1", action: "client.shortlist", entity_id: "a", created_at: "2026-08-21T09:00:00Z" },
    ];
    expect(dedupeDecisions(rows).map((r) => r.id)).toEqual(["1"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  formatWaitingSince,
  formatWindow,
  metricLabel,
  totalMovement,
  weeklyEmailLines,
  type WeeklyUpdate,
} from "../client-weekly-update";

function update(partial: Partial<WeeklyUpdate> = {}): WeeklyUpdate {
  return {
    organization_id: "org-1",
    window_start: "2026-03-07T00:00:00.000Z",
    window_end: "2026-03-14T00:00:00.000Z",
    metrics: [
      { key: "delivered", label: metricLabel("delivered", 3), count: 3, roles: ["Head of RevOps"] },
      { key: "interviews_held", label: metricLabel("interviews_held", 1), count: 1, roles: [] },
      { key: "decisions_made", label: metricLabel("decisions_made", 0), count: 0, roles: [] },
    ],
    awaiting_client: [],
    next_week: [],
    no_movement: false,
    no_movement_reason: null,
    generated_at: "2026-03-14T00:00:00.000Z",
    ...partial,
  };
}

describe("metricLabel", () => {
  it("resolves singular and plural against the count", () => {
    expect(metricLabel("delivered", 1)).toBe("Candidate delivered");
    expect(metricLabel("delivered", 2)).toBe("Candidates delivered");
    expect(metricLabel("interviews_held", 0)).toBe("Interviews held");
    expect(metricLabel("decisions_made", 1)).toBe("Decision made");
  });
});

describe("totalMovement", () => {
  it("sums only counted events", () => {
    expect(totalMovement(update())).toBe(4);
  });

  it("is zero for a quiet week", () => {
    const quiet = update({
      metrics: update().metrics.map((m) => ({ ...m, count: 0, roles: [] })),
      no_movement: true,
    });
    expect(totalMovement(quiet)).toBe(0);
  });
});

describe("weeklyEmailLines", () => {
  it("renders one line per non-zero metric, matching the card counts", () => {
    expect(weeklyEmailLines(update())).toEqual([
      "3 candidates delivered",
      "1 interview held",
    ]);
  });

  it("states a quiet week plainly with the recorded reason", () => {
    const lines = weeklyEmailLines(
      update({
        metrics: update().metrics.map((m) => ({ ...m, count: 0, roles: [] })),
        no_movement: true,
        no_movement_reason: "we are waiting on 1 answer from you before sourcing can continue",
      }),
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("No movement this week");
    expect(lines[0]).toContain("waiting on 1 answer");
  });

  it("never invents commentary when no reason is recorded", () => {
    const lines = weeklyEmailLines(
      update({
        metrics: update().metrics.map((m) => ({ ...m, count: 0 })),
        no_movement: true,
      }),
    );
    expect(lines).toEqual(["No movement this week."]);
  });
});

describe("formatting", () => {
  it("shows the seven-day window", () => {
    expect(formatWindow(update())).toMatch(/–/);
  });

  it("returns null when no wait start is recorded", () => {
    expect(formatWaitingSince(null)).toBeNull();
    expect(formatWaitingSince("not-a-date")).toBeNull();
  });

  it("names the date the wait started", () => {
    expect(formatWaitingSince("2026-03-11T09:00:00.000Z")).toContain("Waiting on you since");
  });
});

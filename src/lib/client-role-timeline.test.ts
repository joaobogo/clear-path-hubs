import { describe, expect, it } from "vitest";
import { buildRoleTimeline, formatTimelineDate } from "./client-role-timeline";

const NOW = new Date("2026-03-01T00:00:00.000Z");

describe("buildRoleTimeline", () => {
  it("marks steps without timestamps as incomplete", () => {
    const t = buildRoleTimeline({ now: NOW });
    expect(t.empty).toBe(true);
    expect(t.steps).toHaveLength(6);
    expect(t.steps.every((s) => s.at === null && !s.complete)).toBe(true);
    expect(formatTimelineDate(t.steps[0]!.at)).toBe("Not yet");
  });

  it("computes elapsed days from the previous completed step only", () => {
    const t = buildRoleTimeline({
      briefConfirmedAt: "2026-01-01T00:00:00.000Z",
      sourcingStartedAt: "2026-01-06T00:00:00.000Z",
      firstShortlistAt: null,
      firstInterviewAt: "2026-01-16T00:00:00.000Z",
      now: NOW,
    });
    const by = Object.fromEntries(t.steps.map((s) => [s.key, s]));
    expect(by.brief_confirmed!.daysFromPrevious).toBeNull();
    expect(by.sourcing_started!.daysFromPrevious).toBe(5);
    expect(by.first_shortlist!.complete).toBe(false);
    expect(by.first_shortlist!.daysFromPrevious).toBeNull();
    // Skips the missing step; measured from sourcing, never inferred.
    expect(by.first_interview!.daysFromPrevious).toBe(10);
    expect(t.empty).toBe(false);
  });

  it("ignores future and invalid timestamps", () => {
    const t = buildRoleTimeline({
      briefConfirmedAt: "2027-01-01T00:00:00.000Z",
      sourcingStartedAt: "not-a-date",
      now: NOW,
    });
    expect(t.empty).toBe(true);
  });
});

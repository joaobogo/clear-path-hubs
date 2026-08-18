import { describe, it, expect } from "vitest";
import { daysSince, formatAge, formatWaiting, formatDaysInStage, ageTone } from "@/lib/time-age";

// Ages are calendar-day based in the workspace timezone (America/Sao_Paulo),
// so fixtures use mid-day UTC stamps that fall on the same calendar day there.
const NOW = new Date("2026-07-30T12:00:00Z");

describe("time-age", () => {
  it("counts whole calendar days and never goes negative", () => {
    expect(daysSince("2026-07-27T09:00:00Z", NOW)).toBe(3);
    expect(daysSince("2026-07-30T09:00:00Z", NOW)).toBe(0);
    expect(daysSince("2026-08-05T09:00:00Z", NOW)).toBe(0);
    expect(daysSince(null, NOW)).toBeNull();
  });

  it("formats age in plain language", () => {
    expect(formatAge("2026-07-30T09:00:00Z", NOW)).toBe("today");
    expect(formatAge("2026-07-29T09:00:00Z", NOW)).toBe("1 day");
    expect(formatAge("2026-07-24T09:00:00Z", NOW)).toBe("6 days");
    expect(formatAge("2026-07-09T09:00:00Z", NOW)).toBe("3 weeks");
  });

  it("labels waiting queue items and stage age", () => {
    expect(formatWaiting("2026-07-27T09:00:00Z", NOW)).toBe("waiting 3 days");
    expect(formatWaiting("2026-07-30T09:00:00Z", NOW)).toBe("waiting since today");
    expect(formatDaysInStage("2026-07-25T09:00:00Z", NOW)).toBe("5 days in stage");
    expect(formatDaysInStage("2026-07-29T09:00:00Z", NOW)).toBe("1 day in stage");
  });

  it("escalates tone as delay grows", () => {
    expect(ageTone("2026-07-30T09:00:00Z", undefined, NOW)).toBe("fresh");
    expect(ageTone("2026-07-26T09:00:00Z", undefined, NOW)).toBe("aging");
    expect(ageTone("2026-07-20T09:00:00Z", undefined, NOW)).toBe("overdue");
  });
});

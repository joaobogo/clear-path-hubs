import { describe, expect, it } from "vitest";
import {
  buildIcs,
  generateSlots,
  labelToMinutes,
  minutesToLabel,
  zonedWallClockToIso,
} from "../availability";

describe("availability", () => {
  it("round-trips time labels", () => {
    expect(minutesToLabel(labelToMinutes("09:30"))).toBe("09:30");
  });

  it("converts a wall clock in a zone to the right instant (DST-aware)", () => {
    // 1 July 2026 10:00 in London is 09:00 UTC (BST).
    expect(zonedWallClockToIso(2026, 7, 1, 600, "Europe/London")).toBe("2026-07-01T09:00:00.000Z");
    // 1 January 2026 10:00 in London is 10:00 UTC (GMT).
    expect(zonedWallClockToIso(2026, 1, 1, 600, "Europe/London")).toBe("2026-01-01T10:00:00.000Z");
  });

  it("generates future slots only, respecting notice period", () => {
    const now = new Date("2026-03-02T08:00:00.000Z"); // Monday
    const slots = generateSlots({
      windows: [1, 2, 3].map((weekday) => ({
        weekday,
        start_minute: 9 * 60,
        end_minute: 12 * 60,
        timezone: "UTC",
      })),
      timezone: "UTC",
      durationMinutes: 60,
      now,
      maxSlots: 4,
    });
    expect(slots.length).toBe(4);
    for (const s of slots) {
      expect(new Date(s).getTime()).toBeGreaterThanOrEqual(now.getTime() + 24 * 3600_000);
    }
    expect([...slots].sort()).toEqual(slots);
  });

  it("returns nothing without windows", () => {
    expect(generateSlots({ windows: [], timezone: "UTC", durationMinutes: 60 })).toEqual([]);
  });

  it("builds an ics without leaking contact details", () => {
    const ics = buildIcs({
      uid: "abc",
      title: "Interview — Chef de Partie",
      startIso: "2026-03-04T09:00:00.000Z",
      durationMinutes: 45,
      location: "https://meet.example.com/x",
    });
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART:20260304T090000Z");
    expect(ics).toContain("DTEND:20260304T094500Z");
    expect(ics).not.toMatch(/@(?!taasflow)/);
  });
});

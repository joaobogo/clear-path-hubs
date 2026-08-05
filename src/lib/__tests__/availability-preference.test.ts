import { describe, expect, it } from "vitest";
import {
  emptyPreference,
  filterSlotsByPreference,
  isPreferenceSet,
  normalizePreference,
  parseStoredPreference,
  preferenceSummary,
  slotFitsPreference,
  mergeIntoAvailability,
} from "@/lib/candidate/availability-preference";

const pref = {
  ...emptyPreference("Europe/London"),
  days: [2, 4], // Tue, Thu
  bands: ["morning" as const],
  unavailable_dates: ["2099-08-13"],
};

describe("availability preference", () => {
  it("treats an unset preference as no restriction", () => {
    expect(isPreferenceSet(emptyPreference("Europe/London"))).toBe(false);
    expect(slotFitsPreference("2026-08-05T22:00:00.000Z", emptyPreference(""))).toBe(true);
  });

  it("matches a Tuesday morning in the stated zone", () => {
    // 2026-08-11 is a Tuesday. 09:30 London.
    expect(slotFitsPreference("2026-08-11T08:30:00.000Z", pref)).toBe(true);
  });

  it("rejects an afternoon and a non-preferred day", () => {
    expect(slotFitsPreference("2026-08-11T14:30:00.000Z", pref)).toBe(false);
    expect(slotFitsPreference("2026-08-12T08:30:00.000Z", pref)).toBe(false);
  });

  it("rejects a date the candidate marked unavailable", () => {
    // 2099-08-13 is a Thursday morning, but it's blocked.
    expect(slotFitsPreference("2099-08-13T08:30:00.000Z", pref)).toBe(false);
  });

  it("reduces slots to stated times but never to nothing", () => {
    const slots = [
      "2026-08-11T08:30:00.000Z", // Tue morning — fits
      "2026-08-11T14:30:00.000Z", // Tue afternoon
      "2026-08-12T08:30:00.000Z", // Wed morning
    ];
    expect(filterSlotsByPreference(slots, pref)).toEqual([slots[0]]);
    expect(filterSlotsByPreference([slots[1]!, slots[2]!], pref)).toEqual([
      slots[1],
      slots[2],
    ]);
  });

  it("round-trips through the availability column beside a note", () => {
    const stored = mergeIntoAvailability({ note: "Two hours' notice" }, normalizePreference(pref));
    expect(stored["note"]).toBe("Two hours' notice");
    expect(parseStoredPreference(stored)?.days).toEqual([2, 4]);
  });

  it("states the empty case plainly", () => {
    expect(preferenceSummary(null)[0]).toMatch(/Not set/);
  });
});

import { describe, expect, it } from "vitest";
import { normalizeTimezoneAnchor } from "@/lib/requisition-schema";

/**
 * The anchor-timezone field looked like it forgot what was typed: the raw
 * value was written to the row, and the next read normalised anything outside
 * two strict shapes to "" — so the audit typed a value, saved, and watched it
 * disappear. The schema now refuses unreadable values at save with a message,
 * the write stores the canonical form, and the normaliser tolerates the
 * spacing people actually type.
 */
describe("normalizeTimezoneAnchor", () => {
  it("accepts IANA zones as-is", () => {
    expect(normalizeTimezoneAnchor("America/New_York")).toBe("America/New_York");
    expect(normalizeTimezoneAnchor("Europe/Lisbon")).toBe("Europe/Lisbon");
    expect(normalizeTimezoneAnchor("America/Argentina/Buenos_Aires")).toBe(
      "America/Argentina/Buenos_Aires",
    );
  });

  it("canonicalises offsets, tolerating the spacing people type", () => {
    expect(normalizeTimezoneAnchor("UTC+1")).toBe("UTC+1");
    expect(normalizeTimezoneAnchor("utc + 1")).toBe("UTC+1");
    expect(normalizeTimezoneAnchor("GMT -3")).toBe("GMT-3");
    expect(normalizeTimezoneAnchor("gmt+05:30")).toBe("GMT+5:30");
    expect(normalizeTimezoneAnchor("UTC")).toBe("UTC");
  });

  it("still refuses what it cannot read — the schema turns this into a message", () => {
    expect(normalizeTimezoneAnchor("Lisbon")).toBe("");
    expect(normalizeTimezoneAnchor("EST")).toBe("");
    expect(normalizeTimezoneAnchor("plus one hour")).toBe("");
    expect(normalizeTimezoneAnchor("")).toBe("");
    expect(normalizeTimezoneAnchor(null)).toBe("");
  });

  it("round-trips its own output", () => {
    for (const input of ["America/New_York", "utc + 1", "GMT -3", "UTC"]) {
      const once = normalizeTimezoneAnchor(input);
      expect(normalizeTimezoneAnchor(once)).toBe(once);
    }
  });
});

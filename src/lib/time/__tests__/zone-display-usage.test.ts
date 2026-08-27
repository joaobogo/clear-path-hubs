import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { zoneDisplay, friendlyZoneName } from "@/lib/time/zone-label";

/**
 * zone-label.ts says outright that "raw slash-separated identifiers must never
 * reach a screen", and then friendlyZoneName had no callers at all: every
 * client surface rendered the column straight out of the database. A
 * pre-launch audit found "America/Sao_Paulo", "Europe/Lisbon" and
 * "Timezone Europe/Lisbon" across interviews, availability and the candidate
 * contact card, and called it the tell that makes a busy manager start
 * double-checking everything else.
 *
 * These are the specific surfaces that were fixed. The check is deliberately
 * narrow — it reads the files rather than pretending to police every render —
 * so it fails when one of them regresses rather than when anything anywhere
 * mentions a timezone.
 */
const GUARDED = [
  "src/components/client/candidate-detail/shared.tsx",
  "src/components/client/candidate-detail/profile.tsx",
  "src/components/client/candidate-comparison.tsx",
  "src/components/client/scheduling/availability-manager.tsx",
];

describe("zoneDisplay", () => {
  it("names the place, not the database row", () => {
    expect(zoneDisplay("America/Sao_Paulo")).toMatch(/^São Paulo \(GMT[+-]?\d*\)$/);
    expect(zoneDisplay("Europe/Lisbon")).toMatch(/^Lisbon \(GMT[+-]?\d*\)$/);
  });

  it("never leaves a slash in the output", () => {
    for (const zone of ["America/Sao_Paulo", "Europe/Lisbon", "America/New_York", "Asia/Tokyo"]) {
      expect(zoneDisplay(zone)).not.toContain("/");
    }
  });

  it("falls back to something readable rather than throwing", () => {
    expect(zoneDisplay(null)).toBe("UTC");
    expect(zoneDisplay("")).toBe("UTC");
  });

  it("de-underscores zones it has no friendly name for", () => {
    expect(friendlyZoneName("Australia/Broken_Hill")).toBe("Broken Hill");
  });
});

describe("client timezone surfaces", () => {
  it.each(GUARDED)("%s renders timezones through zoneDisplay", (file) => {
    const src = readFileSync(file, "utf8");
    expect(src).toContain("zoneDisplay");
  });
});

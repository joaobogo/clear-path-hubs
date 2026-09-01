import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { formatHits, grepSource } from "@tests/helpers/scan-source";
import { APP_LOCALE, formatDate, formatDateTime } from "../datetime";

/**
 * The UI is English. A screen must never mix languages inside its date
 * strings, so no call site may inherit the browser locale.
 *
 * The two source scans below shelled out to ripgrep through `/bin/bash` and so
 * threw `spawnSync ENOENT` on Windows rather than checking anything. They read
 * as environmental failures for long enough to stop being read at all — a
 * guard that cannot fire, which is the class of defect these guards exist to
 * catch. They now walk the tree with node:fs.
 */
const SRC = join(process.cwd(), "src");

describe("date locale pinning", () => {
  it("formats dates in the app locale and workspace timezone", () => {
    expect(APP_LOCALE).toBe("en-GB");
    // Standardised on the unambiguous "14 Aug 2026" form across the product.
    expect(formatDate("2026-08-14T23:30:00Z")).toBe("14 Aug 2026");
    // The zone is always named: only the client shell ever set the workspace
    // timezone, so admin surfaces printed times three hours off the reader's
    // own clock with nothing saying so (audit #6, A6-24).
    expect(formatDateTime("2026-08-14T23:30:00Z")).toBe("14 Aug 2026, 20:30 GMT-3");
  });

  it("normalises September to the three-letter 'Sep' standard", () => {
    // en-GB shortens September as "Sept"; the UI standard is "Sep".
    // Read in workspace time (UTC-3), so midnight UTC is still the 14th.
    expect(formatDate("2026-09-15T00:00:00Z")).toBe("14 Sep 2026");
    expect(formatDateTime("2026-09-15T00:00:00Z")).toBe("14 Sep 2026, 21:00 GMT-3");
  });

  it("has no browser-locale date formatting left in src", () => {
    const hits = grepSource(
      SRC,
      /toLocale(Date|Time)String\(\s*(undefined|\))|Intl\.DateTimeFormat\(\s*undefined/,
      { exclude: [/__tests__/] },
    );
    expect(formatHits(hits)).toBe("");
  });

  it("never pins a non-English locale for display", () => {
    const hits = grepSource(SRC, /toLocale(Date|Time)String\(\s*["']pt/, {
      exclude: [/__tests__/],
    });
    expect(formatHits(hits)).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { APP_LOCALE, formatDate, formatDateTime } from "../datetime";

/**
 * The UI is English. A screen must never mix languages inside its date
 * strings, so no call site may inherit the browser locale.
 */
describe("date locale pinning", () => {
  it("formats dates in the app locale and workspace timezone", () => {
    expect(APP_LOCALE).toBe("en-GB");
    // Standardised on the unambiguous "14 Aug 2026" form across the product.
    expect(formatDate("2026-08-14T23:30:00Z")).toBe("14 Aug 2026");
    expect(formatDateTime("2026-08-14T23:30:00Z")).toBe("14 Aug 2026, 20:30");
  });

  it("has no browser-locale date formatting left in src", () => {
    const hits = run(
      `rg -n --glob '!**/__tests__/**' "toLocale(Date|Time)String\\(\\s*(undefined|\\))|Intl\\.DateTimeFormat\\(\\s*undefined" src || true`,
    );
    expect(hits).toBe("");
  });

  it("never pins a non-English locale for display", () => {
    const hits = run(
      `rg -n --glob '!**/__tests__/**' "toLocale(Date|Time)String\\(\\s*[\\"']pt" src || true`,
    );
    expect(hits).toBe("");
  });
});

function run(cmd: string): string {
  return execSync(cmd, { encoding: "utf8", shell: "/bin/bash" }).trim();
}

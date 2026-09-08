import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Consent has to be honoured by the code, not just by the banner — for every
 * tracker except the one the owner has deliberately exempted.
 *
 * A visitor who chose "Decline all" once had RB2B load on the next page and
 * call its API, because it was booted from the server-rendered head
 * "independent of any consent UI" and then exempted a second time from the
 * consent loop (audit #6, A6-04). Three audits later the owner reversed that:
 * RB2B is always-on by decision (2026-09-07, see ALWAYS_ON_TRACKERS), and the
 * tests below now hold that exemption to RB2B ALONE. Nothing else may slip
 * through the same three gates.
 *
 * These are source-level assertions on purpose: the original defect was two
 * `continue` statements and a head snippet, none of which a unit test of the
 * public API would have caught.
 */
const PIXELS = readFileSync(join(process.cwd(), "src/lib/tracking/pixels.ts"), "utf8");

/** Source with comments removed — a comment naming a tracker is not code. */
const CODE = PIXELS.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("consent gating", () => {
  it("boots no marketing tracker from the inline head snippets", () => {
    // RB2B is in the head too, but as an EXTERNAL tag (rb2bHeadScripts) so a
    // pending stylesheet cannot delay it — see rb2b-always-on.test.ts. The
    // inline snippets are GA4's alone.
    const head = CODE.slice(
      CODE.indexOf("export const HEAD_BOOT_SNIPPETS"),
      CODE.indexOf("function alreadyInDocument"),
    );
    expect(head).not.toMatch(/reb2b/i);
    expect(head).not.toMatch(/facebook|fbevents|licdn|clarity\.ms|hotjar/i);
  });

  it("exempts only GA4 from the consent loop", () => {
    const loop = CODE.slice(CODE.indexOf("for (const key of Object.keys(INITIALISERS)"));
    const exempted = [...loop.matchAll(/key === "([a-z0-9]+)"/g)].map((m) => m[1]);
    // GA4 is the one legitimate exception: it loads in consent mode with
    // storage denied and upgrades once analytics is allowed.
    expect(exempted).toEqual(["ga4"]);
  });

  /**
   * The third gate. `isTrackerAllowed` short-circuits on the always-on list
   * before any consent or region check runs (audit #7, 2.1). RB2B is on it by
   * decision; GA4 must never be — while it was, syncGA4Consent granted
   * analytics_storage and wrote _ga cookies AFTER a "Decline all", beside a
   * banner reading "it sets no cookies" (audit #8, TF8-05).
   */
  it("treats RB2B, and only RB2B, as always-on", () => {
    const consent = readFileSync(join(process.cwd(), "src/lib/tracking/consent.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    const list = /ALWAYS_ON_TRACKERS\s*=\s*\[([^\]]*)\]/.exec(consent)?.[1] ?? "";
    const keys = [...list.matchAll(/"([a-z0-9]+)"/g)].map((m) => m[1]);
    expect(keys).toEqual(["rb2b"]);
  });

  it("keeps every non-analytics tracker in a consent category", () => {
    // A tracker with no category cannot be gated.
    const block = CODE.slice(
      CODE.indexOf("TRACKER_CATEGORY"),
      CODE.indexOf("const INITIALISERS"),
    );
    for (const key of ["rb2b", "meta", "linkedin", "clarity", "hotjar"]) {
      expect(block, `${key} has no consent category`).toMatch(
        new RegExp(`${key}:\\s*"(analytics|marketing)"`),
      );
    }
  });
});

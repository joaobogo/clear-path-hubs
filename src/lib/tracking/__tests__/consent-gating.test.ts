import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Consent has to be honoured by the code, not just by the banner.
 *
 * A visitor who chose "Decline all" still had RB2B — a de-anonymisation
 * tracker — load on the next page and call its API, because it was booted
 * from the server-rendered head "independent of any consent UI" and then
 * exempted a second time from the consent loop (audit #6, A6-04).
 *
 * These are source-level assertions on purpose: the defect was two `continue`
 * statements and a head snippet, none of which a unit test of the public API
 * would have caught.
 */
const PIXELS = readFileSync(join(process.cwd(), "src/lib/tracking/pixels.ts"), "utf8");

/** Source with comments removed — a comment naming a tracker is not code. */
const CODE = PIXELS.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("consent gating", () => {
  it("boots no marketing tracker from the server-rendered head", () => {
    const head = CODE.slice(
      CODE.indexOf("HEAD_BOOT_SNIPPETS"),
      CODE.indexOf("function alreadyInDocument"),
    );
    expect(head).not.toMatch(/rb2b/i);
    expect(head).not.toMatch(/reb2b/i);
    expect(head).not.toMatch(/meta|facebook|licdn/i);
  });

  it("exempts only GA4 from the consent loop", () => {
    const loop = CODE.slice(CODE.indexOf("for (const key of Object.keys(INITIALISERS)"));
    const exempted = [...loop.matchAll(/key === "([a-z0-9]+)"/g)].map((m) => m[1]);
    // GA4 is the one legitimate exception: it loads in consent mode with
    // storage denied and upgrades once analytics is allowed.
    expect(exempted).toEqual(["ga4"]);
  });

  /**
   * The third gate. Removing RB2B's head snippet and its by-name exemption
   * from the initialiser loop was not enough: `isTrackerAllowed` short-circuits
   * on an "always on" list that still contained it, so "Decline all" was
   * overruled before either of the other two fixes ran (audit #7, 2.1).
   */
  it("treats nothing as always-on", () => {
    // GA4 has since come off this list too. While it was on it,
    // isTrackerAllowed("ga4", …) returned true whatever the visitor chose, so
    // syncGA4Consent granted analytics_storage and reconfigured GA without
    // client_storage:"none" — writing _ga and _ga_<id> AFTER a "Decline all",
    // beside a banner reading "it sets no cookies and cannot identify you"
    // (audit #8, TF8-05). Anything genuinely necessary belongs in the stored
    // tracking policy, where it is visible and auditable.
    const consent = readFileSync(join(process.cwd(), "src/lib/tracking/consent.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    const list = /ALWAYS_ON_TRACKERS\s*=\s*\[([^\]]*)\]/.exec(consent)?.[1] ?? "";
    const keys = [...list.matchAll(/"([a-z0-9]+)"/g)].map((m) => m[1]);
    expect(keys).toEqual([]);
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

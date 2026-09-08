/**
 * The regional consent gate: prior opt-in where the law requires it,
 * optional trackers permitted by default everywhere else.
 *
 * RB2B and the LinkedIn tag were "installed" for weeks and saw no traffic.
 * The snippet was right and the key valid; the stored tracking policy had
 * been seeded with require_prior_opt_in_everywhere = true and the code
 * default agreed, so a visitor in São Paulo or New York was held behind the
 * EU gate until they clicked "Accept all" — which on a B2B site is nearly
 * nobody. The published privacy policy had described the regional rule all
 * along; the code was simply stricter than what it told visitors.
 *
 * Three things have to agree for the gate to behave: the default in code, the
 * default in the database, and the server-side fallback. These pin all three
 * to one another, and pin the rule itself against real time zones.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_TRACKING_POLICY,
  isAllowed,
  requiresPriorOptIn,
  writeConsent,
} from "@/lib/tracking/consent";

function inZone(zone: string) {
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
    timeZone: zone,
  } as Intl.ResolvedDateTimeFormatOptions);
}

/** A window with just enough surface for the consent store to write and read. */
function stubBrowser() {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    dispatchEvent: () => true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("the default policy", () => {
  it("requires prior opt-in only where the law does", () => {
    expect(DEFAULT_TRACKING_POLICY.requirePriorOptInEverywhere).toBe(false);
  });

  it("still treats nothing as strictly necessary", () => {
    // Permitted-by-default is a regional rule, not an always-on list. A tag
    // that must ignore the visitor's choice belongs in the stored policy,
    // where it is visible and auditable.
    expect(DEFAULT_TRACKING_POLICY.essentialTrackers).toEqual([]);
  });
});

describe("outside the EU/EEA, UK and Switzerland", () => {
  for (const zone of [
    "America/Sao_Paulo",
    "America/New_York",
    "America/Los_Angeles",
    "Asia/Kolkata",
    "Australia/Sydney",
    // In the Europe/ tree but outside the opt-in regions.
    "Europe/Istanbul",
    "Europe/Moscow",
  ]) {
    it(`${zone}: optional trackers run before any decision`, () => {
      inZone(zone);
      expect(requiresPriorOptIn()).toBe(false);
      expect(isAllowed("marketing"), "RB2B and LinkedIn are marketing").toBe(true);
      expect(isAllowed("analytics")).toBe(true);
    });
  }
});

describe("inside the EU/EEA, UK and Switzerland", () => {
  for (const zone of [
    "Europe/Lisbon",
    "Europe/Berlin",
    "Europe/London",
    "Europe/Zurich",
    "Europe/Dublin",
    "Atlantic/Reykjavik",
    "Atlantic/Canary",
  ]) {
    it(`${zone}: nothing optional runs until the visitor decides`, () => {
      inZone(zone);
      expect(requiresPriorOptIn()).toBe(true);
      expect(isAllowed("marketing")).toBe(false);
      expect(isAllowed("analytics")).toBe(false);
    });
  }

  it("fails closed when the zone cannot be read", () => {
    inZone("");
    expect(requiresPriorOptIn()).toBe(true);
  });
});

describe("an explicit decision always wins", () => {
  it("a visitor outside the opt-in regions who declines is not tracked", () => {
    stubBrowser();
    inZone("America/New_York");
    expect(isAllowed("marketing"), "permitted by default first").toBe(true);
    writeConsent({ analytics: false, marketing: false }, "reject_all");
    expect(isAllowed("marketing")).toBe(false);
    expect(isAllowed("analytics")).toBe(false);
  });

  it("a visitor inside the opt-in regions who accepts is tracked", () => {
    stubBrowser();
    inZone("Europe/Lisbon");
    expect(isAllowed("marketing"), "gated first").toBe(false);
    writeConsent({ analytics: true, marketing: true }, "accept_all");
    expect(isAllowed("marketing")).toBe(true);
  });
});

describe("the first visit waits for the stored policy", () => {
  const strip = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const observer = () =>
    strip(
      readFileSync(
        join(process.cwd(), "src/components/analytics/tracking-route-observer.tsx"),
        "utf8",
      ),
    );

  it("boots at hydration only on a policy this browser has already seen", () => {
    // A permissive default booted before the stored policy is read cannot be
    // un-booted when that policy turns out to require opt-in everywhere.
    expect(observer()).toMatch(/if\s*\(hasCachedTrackingPolicy\(\)\)\s*initializeTrackers\(\)/);
  });

  it("still boots on the regional default when the policy cannot be read", () => {
    const code = observer();
    const catchBlock = code.slice(code.indexOf(".catch("));
    expect(catchBlock, "a failed read must not silently apply the strict gate").toMatch(
      /initializeTrackers\(\)/,
    );
  });

  it("knows whether a policy has been seen", async () => {
    vi.resetModules();
    stubBrowser();
    const consent = await import("@/lib/tracking/consent");
    expect(consent.hasCachedTrackingPolicy(), "fresh browser").toBe(false);
    consent.setTrackingPolicy({ essentialTrackers: [], requirePriorOptInEverywhere: false });
    expect(consent.hasCachedTrackingPolicy(), "after the read").toBe(true);
    // And across a reload, from the cache.
    vi.resetModules();
    const again = await import("@/lib/tracking/consent");
    expect(again.hasCachedTrackingPolicy(), "from localStorage").toBe(true);
  });
});

describe("one definition, three places", () => {
  const src = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

  it("the server fallback imports the client default rather than restating it", () => {
    const code = src("src/lib/tracking/policy.functions.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).toContain("DEFAULT_TRACKING_POLICY");
    // A second literal here is how the two came to disagree.
    expect(code).not.toMatch(/requirePriorOptInEverywhere:\s*(true|false)\s*,?\s*\n\s*updatedAt/);
  });

  it("the database default and the seeded row were brought into line", () => {
    const sql = src(
      "supabase/migrations/20260907230000_tracking_policy_regional_gate.sql",
    ).toLowerCase();
    expect(sql).toMatch(/alter\s+column\s+require_prior_opt_in_everywhere\s+set\s+default\s+false/);
    expect(sql).toMatch(/update\s+public\.tracking_policy[\s\S]*set\s+require_prior_opt_in_everywhere\s*=\s*false/);
  });

  it("the published privacy policy describes the same rule", () => {
    // The wording visitors read must not promise a stricter or looser gate
    // than the code applies.
    const privacy = src("src/content/pages/privacy.json");
    expect(privacy).toMatch(/EU, EEA, UK or Switzerland[^"]*nothing[^"]*until you give explicit\s*consent/);
    expect(privacy).toMatch(/Elsewhere, those categories are enabled by default/);
  });
});

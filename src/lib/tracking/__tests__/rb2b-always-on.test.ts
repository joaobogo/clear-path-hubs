import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALWAYS_ON_TRACKERS,
  isTrackerAllowed,
  isTrackerEssential,
  writeConsent,
} from "@/lib/tracking/consent";
import {
  RB2B_ID,
  RB2B_SRC,
  WORKSPACE_PATH_PREFIXES,
  isWorkspacePath,
  rb2bHeadLinks,
  rb2bHeadScripts,
} from "@/lib/tracking/pixels";

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

describe("RB2B consent gate", () => {
  it("keeps the configured vendor script but never emits it from the server head", () => {
    expect(RB2B_SRC).toBe(
      `https://ddwl4m2hdecbv.cloudfront.net/b/${RB2B_ID}/${RB2B_ID}.js.gz`,
    );
    for (const path of ["/", "/pricing", "/jobs", "/login", ...WORKSPACE_PATH_PREFIXES.map((p) => `/${p}`)]) {
      expect(rb2bHeadLinks(path)).toEqual([]);
      expect(rb2bHeadScripts(path)).toEqual([]);
    }
  });

  it("is never classified as essential", () => {
    expect([...ALWAYS_ON_TRACKERS]).toEqual([]);
    expect(isTrackerEssential("rb2b")).toBe(false);
  });

  it("waits for marketing consent in EU/EEA, UK and Switzerland", () => {
    stubBrowser();
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      timeZone: "Europe/Berlin",
    } as Intl.ResolvedDateTimeFormatOptions);

    expect(isTrackerAllowed("rb2b", "marketing")).toBe(false);
    writeConsent({ analytics: false, marketing: false }, "reject_all");
    expect(isTrackerAllowed("rb2b", "marketing")).toBe(false);
    writeConsent({ analytics: false, marketing: true }, "granular");
    expect(isTrackerAllowed("rb2b", "marketing")).toBe(true);
  });

  it("honours opt-out outside prior-opt-in regions", () => {
    stubBrowser();
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      timeZone: "America/New_York",
    } as Intl.ResolvedDateTimeFormatOptions);

    expect(isTrackerAllowed("rb2b", "marketing")).toBe(true);
    writeConsent({ analytics: true, marketing: false }, "granular");
    expect(isTrackerAllowed("rb2b", "marketing")).toBe(false);
  });

  it("still blocks public trackers from workspace paths", () => {
    for (const path of ["/client", "/client/candidates", "/admin", "/me/profile", "/CLIENT"]) {
      expect(isWorkspacePath(path)).toBe(true);
    }
  });
});

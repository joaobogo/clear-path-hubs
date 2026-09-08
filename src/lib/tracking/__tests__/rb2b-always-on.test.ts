/**
 * RB2B fires on every public page, as early as the document allows, whatever
 * the visitor's region, consent choice, or the state of the tracking policy.
 *
 * Owner's decision, 2026-09-07. RB2B is the lead-identification tool, and
 * three audits' worth of consent gating had left it never firing at all: it
 * loaded only for visitors who clicked "Accept all", which on a B2B site is
 * nearly nobody. The owner chose to run it unconditionally and accepts the
 * privacy trade-off.
 *
 * What these hold, each one a defect that was found and fixed:
 *
 *  - It is an EXTERNAL ASYNC tag, not an inline loader. An inline script
 *    cannot execute while a stylesheet is pending, and this head links Google
 *    Fonts CSS, so an inline loader waited on a cold third-party round trip
 *    before it could even reveal the vendor URL.
 *  - Its preload link precedes the stylesheets, so the fetch starts first.
 *  - The workspace exclusion is decided on the SERVER, so the tag is absent
 *    from workspace HTML rather than present-and-guarded.
 *  - The path test is case-INSENSITIVE, because the router is.
 *  - SPA navigations re-collect through the API the vendor actually exposes.
 *  - No consent state, region, or policy can stop it.
 *  - Every surface that describes it says the same thing.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HEAD_BOOT_SNIPPETS,
  RB2B_ID,
  RB2B_ORIGINS,
  RB2B_SRC,
  WORKSPACE_PATH_PREFIXES,
  isWorkspacePath,
  rb2bHeadLinks,
  rb2bHeadScripts,
} from "@/lib/tracking/pixels";
import {
  ALWAYS_ON_TRACKERS,
  isTrackerAllowed,
  isTrackerEssential,
  writeConsent,
} from "@/lib/tracking/consent";

const PUBLIC_PATHS = ["/", "/pricing", "/jobs", "/jobs/senior-engineer", "/apply/123", "/platform", "/login", "/auth"];

const src = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

/**
 * The body of notifyRouteChange, comments removed. Sliced on CODE markers —
 * an earlier version of this test sliced on comment text, which `strip` had
 * already removed, so it asserted against an empty string and passed for the
 * wrong reason.
 */
function routeChangeBody(): string {
  const code = strip(src("src/lib/tracking/pixels.ts"));
  const from = code.indexOf("function notifyRouteChange");
  const to = code.indexOf("export function trackPageView");
  expect(from, "notifyRouteChange not found").toBeGreaterThan(-1);
  expect(to, "trackPageView not found").toBeGreaterThan(from);
  return code.slice(from, to);
}

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

describe("the RB2B head tag", () => {
  it("points at the vendor script for this account", () => {
    expect(RB2B_SRC).toBe(`https://ddwl4m2hdecbv.cloudfront.net/b/${RB2B_ID}/${RB2B_ID}.js.gz`);
  });

  it("is emitted on every public page", () => {
    for (const p of PUBLIC_PATHS) {
      const tags = rb2bHeadScripts(p);
      expect(tags.length, `${p}: exactly one tag`).toBe(1);
      expect(tags[0].src).toBe(RB2B_SRC);
    }
  });

  it("is external and async, so a pending stylesheet cannot delay it", () => {
    // The whole reason it is not an inline loader. An inline script waits for
    // the Google Fonts stylesheet this head links; an async external one is
    // found by the preload scanner and executes on arrival.
    const [tag] = rb2bHeadScripts("/");
    expect(tag.async).toBe(true);
    expect(tag.src, "must be external, not inline children").toBeTruthy();
    expect(tag).not.toHaveProperty("children");
  });

  it("carries the marker the client initialiser dedupes on", () => {
    expect(rb2bHeadScripts("/")[0]["data-tracker"]).toBe("rb2b");
  });

  it("is no longer an inline snippet, and GA4 is the only one left", () => {
    const inline = HEAD_BOOT_SNIPPETS.map((s) => s.children).join("\n");
    expect(inline).not.toMatch(/reb2b/);
    expect(HEAD_BOOT_SNIPPETS.every((s) => s.key === "ga4")).toBe(true);
  });
});

describe("as early as the document allows", () => {
  it("preloads the script and preconnects both RB2B origins", () => {
    const links = rb2bHeadLinks("/");
    const preload = links.find((l) => l.rel === "preload");
    expect(preload, "no preload link").toBeDefined();
    expect(preload!.href).toBe(RB2B_SRC);
    expect(preload!.as).toBe("script");
    for (const origin of RB2B_ORIGINS) {
      expect(links.some((l) => l.rel === "preconnect" && l.href === origin), origin).toBe(true);
    }
  });

  it("puts those links AHEAD of the render-blocking stylesheets in the root head", () => {
    // Links are emitted in order. Behind the fonts stylesheet, the preload
    // would be pointless.
    const root = src("src/routes/__root.tsx");
    const rb2bAt = root.indexOf("rb2bHeadLinks(pathname)");
    const fontsAt = root.indexOf("fonts.googleapis.com");
    expect(rb2bAt).toBeGreaterThan(-1);
    expect(fontsAt).toBeGreaterThan(-1);
    expect(rb2bAt, "RB2B links must precede the fonts stylesheet").toBeLessThan(fontsAt);
  });

  it("renders the tag from the root head", () => {
    expect(src("src/routes/__root.tsx")).toMatch(/rb2bHeadScripts\(pathname\)/);
  });
});

describe("never on the signed-in workspace", () => {
  it("emits no tag and no links for a workspace path", () => {
    for (const p of WORKSPACE_PATH_PREFIXES) {
      for (const path of [`/${p}`, `/${p}/`, `/${p}/candidates/abc`]) {
        expect(rb2bHeadScripts(path), `script on ${path}`).toEqual([]);
        expect(rb2bHeadLinks(path), `links on ${path}`).toEqual([]);
      }
    }
  });

  it("excludes odd-case workspace URLs, which the router still serves", () => {
    // TanStack matches routes case-insensitively, so /Client?org=<uuid> is a
    // real workspace page. A case-sensitive guard let it through.
    for (const path of ["/Client", "/CLIENT/candidates", "/Admin", "/ADMIN/", "/Me", "/mE/profile"]) {
      expect(isWorkspacePath(path), path).toBe(true);
      expect(rb2bHeadScripts(path), `script on ${path}`).toEqual([]);
    }
  });

  it("does not mistake a public path that merely starts with a workspace word", () => {
    for (const path of ["/members", "/clients", "/administration"]) {
      expect(isWorkspacePath(path), path).toBe(false);
      expect(rb2bHeadScripts(path).length, path).toBe(1);
    }
  });

  it("hands off to the workspace with a full page load after sign-in", () => {
    // The head guard only runs on a document load. A client-side navigate()
    // from /login or /auth carried the already-booted tag into /client.
    const login = strip(src("src/routes/login.tsx"));
    expect(login, "single-org client sign-in").not.toMatch(/navigate\(\{\s*to:\s*"\/client"/);
    expect(login).toMatch(/window\.location\.assign\(\s*\n?\s*org\?\.organization_id/);
    const auth = strip(src("src/routes/auth.tsx"));
    expect(auth).not.toMatch(/navigate\(\{\s*to:\s*landingPathForRole/);
    expect(auth).toMatch(/window\.location\.replace\(landingPathForRole/);
  });

  it("re-collects on SPA navigation only for public paths", () => {
    const block = routeChangeBody();
    expect(block, "must guard the re-collect on the path").toMatch(/isWorkspacePath/);
  });
});

describe("nothing can gate RB2B", () => {
  it("is on the always-on list, alone", () => {
    expect([...ALWAYS_ON_TRACKERS]).toEqual(["rb2b"]);
    expect(isTrackerEssential("rb2b")).toBe(true);
  });

  it("passes the consent gate in an opt-in region after Decline all", () => {
    stubBrowser();
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      timeZone: "Europe/Berlin",
    } as Intl.ResolvedDateTimeFormatOptions);
    writeConsent({ analytics: false, marketing: false }, "reject_all");
    expect(isTrackerAllowed("rb2b", "marketing")).toBe(true);
    // The exemption is RB2B's alone.
    expect(isTrackerAllowed("linkedin", "marketing")).toBe(false);
    expect(isTrackerAllowed("meta", "marketing")).toBe(false);
  });

  it("is not something the client initialiser loop skips by name", () => {
    const loop = strip(src("src/lib/tracking/pixels.ts"));
    const tail = loop.slice(loop.indexOf("for (const key of Object.keys(INITIALISERS)"));
    expect(tail).not.toMatch(/key === "rb2b"/);
  });
});

describe("SPA navigation reaches RB2B", () => {
  it("calls the method the vendor object actually exposes", () => {
    // The vendor object is a frozen {loaded, assignIdentity, collect}. The old
    // code tried identify(), then push(["identify"]), then array push — three
    // silent no-ops, so only the landing page was ever counted.
    const block = routeChangeBody();
    expect(block).toMatch(/\.collect\(\)/);
    expect(block, "identify() does not exist on the vendor object").not.toMatch(/identify/);
  });

  it("attributes the vendor API origin in CSP diagnostics", () => {
    const code = strip(src("src/lib/tracking/pixels.ts"));
    const fn = code.slice(code.indexOf("function trackerForUri"));
    expect(fn).toMatch(/rb2b\\?\.com/);
  });
});

describe("every surface tells the same story", () => {
  it("the privacy policy no longer calls RB2B consent-gated", () => {
    const privacy = src("src/content/pages/privacy.json");
    expect(privacy).not.toMatch(/RB2B[^|\n]*consent-gated/);
    expect(privacy).toMatch(/always on; legitimate interest/);
  });

  it("the Trust Center claim matches the register it cites", () => {
    expect(src("src/config/trust-center.ts")).not.toMatch(/consent-gated business-visitor/);
  });

  it("the public integrations directory does not promise tags never load", () => {
    expect(src("src/config/integrations-directory.ts")).not.toMatch(
      /Declining consent means the tags never load/,
    );
  });

  it("the governance provider register agrees with the privacy notice", () => {
    const reg = src("docs/governance/provider-register.md");
    expect(reg).not.toMatch(/RB2B \| Business-visitor identification \(consent-gated\)/);
    expect(reg).toMatch(/always on; legitimate interest/);
  });

  it("the consent banner does not offer a switch that would stop RB2B", () => {
    const banner = src("src/components/analytics/consent-banner.tsx");
    expect(banner).not.toMatch(/Meta and LinkedIn, plus our business visitor tool/);
    expect(banner).toMatch(/RB2B\) runs on every page/);
  });

  it("the admin tracking page shows RB2B as always-on", () => {
    const page = src("src/routes/_authenticated/admin.tracking.tsx");
    expect(page).toMatch(/ALWAYS_ON_TRACKERS/);
    expect(page).toMatch(/Always on/);
  });

  it("the pixels module header no longer claims everything waits for consent", () => {
    const header = src("src/lib/tracking/pixels.ts").slice(0, 1400);
    expect(header).toMatch(/RB2B is exempt/);
    expect(header).not.toMatch(/All injection happens on\s*\n?\s*\* the client after hydration/);
  });

  it("the tracking doc describes the server-rendered tag", () => {
    expect(src("docs/tracking-pixels.md")).toMatch(/server-rendered `<head>` tag/);
  });
});

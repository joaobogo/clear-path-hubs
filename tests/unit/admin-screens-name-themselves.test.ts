/**
 * Every admin screen names itself, in one format.
 *
 * Four conventions were in use across one product — "Positions · TaaSFlow
 * admin", "Team — Admin · TaaSFlow", "Payments ledger — Admin | TaaSFlow",
 * "Delivery health · TaaSFlow" (no "admin") — and two routes named themselves
 * not at all: /admin/clients and /admin/clients/$id fell through to the
 * generic "Admin · TaaSFlow". The clients desk is the one screen with a
 * client's name on it (audit 1 Sep, F32).
 *
 * The title is what a browser tab, a bookmark, a history entry and a screen
 * reader all announce, so a desk that does not name itself is unfindable by
 * every one of those routes at once.
 *
 * Format of record: "<Screen> · TaaSFlow admin". It was already the majority
 * convention; this pins it.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROUTES = join(process.cwd(), "src", "routes", "_authenticated");
const SUFFIX = " · TaaSFlow admin";

/**
 * Two kinds of route legitimately have no title of their own, and both are
 * recognised by their shape rather than by name — a hand-maintained list of
 * exemptions is the escape hatch that would let this finding back in.
 *
 *   - A pure redirect renders nothing; the destination titles the screen.
 *   - A layout route wraps children that each title themselves.
 */
function isRedirectOnly(src: string): boolean {
  return /throw redirect\(/.test(src) && !/component:/.test(src);
}

function isLayout(src: string): boolean {
  return /<Outlet\s*\/>/.test(src);
}

function adminRouteFiles(): string[] {
  return readdirSync(ROUTES)
    .filter((f) => f.startsWith("admin") && f.endsWith(".tsx"))
    .sort();
}

function titlesIn(src: string): string[] {
  return [...src.matchAll(/\{\s*title:\s*"([^"]+)"\s*\}/g)].map((m) => m[1]!);
}

describe("admin document titles", () => {
  const files = adminRouteFiles();

  it("finds the admin routes at all", () => {
    // A scan that matches nothing passes silently; refuse to be that.
    expect(files.length).toBeGreaterThan(20);
  });

  it("gives every admin screen a title", () => {
    const untitled = files.filter((f) => {
      const src = readFileSync(join(ROUTES, f), "utf8");
      if (isRedirectOnly(src) || isLayout(src)) return false;
      return titlesIn(src).length === 0;
    });
    expect(untitled, "these admin routes fall through to the generic title").toEqual([]);
  });

  it("uses one format", () => {
    const wrong: string[] = [];
    for (const f of files) {
      const src = readFileSync(join(ROUTES, f), "utf8");
      // The layout carries the fallback title, not a screen name.
      if (isLayout(src)) continue;
      for (const title of titlesIn(src)) {
        if (!title.endsWith(SUFFIX)) wrong.push(`${f}: ${title}`);
      }
    }
    expect(wrong, `admin titles must end with "${SUFFIX}"`).toEqual([]);
  });

  it("names the screen before the suffix", () => {
    // "· TaaSFlow admin" alone is the generic title this finding was about.
    for (const f of files) {
      const src = readFileSync(join(ROUTES, f), "utf8");
      if (isLayout(src)) continue;
      for (const title of titlesIn(src)) {
        expect(title.slice(0, -SUFFIX.length).trim().length, `${f}: ${title}`).toBeGreaterThan(2);
      }
    }
  });
});

describe("nav labels name the page they open", () => {
  const nav = readFileSync(join(process.cwd(), "src", "config", "admin-nav.ts"), "utf8");
  const sections = readFileSync(
    join(process.cwd(), "src", "config", "workspace-sections.ts"),
    "utf8",
  );

  it("calls /admin/messages what its heading calls it", () => {
    // The page is headed "Conversations".
    expect(nav).not.toMatch(/to: "\/admin\/messages",\s*\n\s*label: "(Messages|Comms)"/);
    expect(sections).not.toMatch(/to: "\/admin\/messages", label: "Messages"/);
  });

  it("calls /admin/notifications what its heading calls it", () => {
    // The page is headed "Delivery health".
    expect(nav).not.toMatch(/to: "\/admin\/notifications",\s*\n\s*label: "Notifications"/);
    expect(sections).not.toMatch(/to: "\/admin\/notifications", label: "Notifications"/);
  });
});

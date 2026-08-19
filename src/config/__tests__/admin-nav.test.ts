/**
 * Guards the admin navigation config against silent drift.
 *
 * Adding an admin desk without listing it in a section group makes it
 * unreachable from the UI; listing it twice makes the tab strip disagree with
 * itself. Both used to be invisible until someone noticed a missing tab.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ADMIN_SECTION_GROUPS } from "@/config/workspace-sections";
import { ADMIN_NAV } from "@/config/admin-nav";

const ROUTES_DIR = join(process.cwd(), "src/routes/_authenticated");

/**
 * Routes that are intentionally absent from the tab config: the layout itself,
 * detail/child screens reached from a list rather than a tab, create screens,
 * and redirect-only stubs that exist purely to keep an old URL alive.
 */
function isDeskRoute(file: string): boolean {
  if (!file.startsWith("admin")) return false;
  if (file === "admin.tsx") return false;
  // `$` marks a param segment: detail pages and their children.
  if (file.includes("$")) return false;
  // Create screens are reached from a button on their list desk, not a tab.
  if (file.endsWith(".new.tsx")) return false;
  // Retired routes kept only as redirects render no desk of their own.
  const src = readFileSync(join(ROUTES_DIR, file), "utf8");
  if (/throw redirect\(/.test(src) && !/component:/.test(src)) return false;
  // `x.index.tsx` pairs with its `x.tsx` layout; the layout carries the tab.
  return true;
}

/** "admin.scoring.review.index.tsx" -> "/admin/scoring/review" */
function routePath(file: string): string {
  const segments = file.replace(/\.tsx$/, "").split(".");
  const trimmed = segments[segments.length - 1] === "index" ? segments.slice(0, -1) : segments;
  return `/${trimmed.join("/")}`;
}

const deskPaths = [
  ...new Set(
    readdirSync(ROUTES_DIR)
      .filter((f) => f.endsWith(".tsx") && isDeskRoute(f))
      .map(routePath),
  ),
];

const tabPaths = ADMIN_SECTION_GROUPS.flatMap((g) => g.tabs.map((t) => t.to as string));

describe("admin navigation config", () => {
  it("lists every admin desk route in a section group", () => {
    const missing = deskPaths.filter((p) => !tabPaths.includes(p)).sort();
    expect(missing).toEqual([]);
  });

  it("never lists a desk in more than one group", () => {
    const seen = new Map<string, number>();
    for (const p of tabPaths) seen.set(p, (seen.get(p) ?? 0) + 1);
    const duplicates = [...seen.entries()].filter(([, n]) => n > 1).map(([p]) => p);
    expect(duplicates).toEqual([]);
  });

  it("only references routes that exist", () => {
    const unknown = tabPaths.filter((p) => !deskPaths.includes(p)).sort();
    expect(unknown).toEqual([]);
  });

  it("keeps the primary sidebar at ten entries or fewer", () => {
    expect(ADMIN_NAV.length).toBeLessThanOrEqual(10);
  });

  it("points every sidebar entry at a group that exists", () => {
    const groupLabels = new Set(ADMIN_SECTION_GROUPS.map((g) => g.label));
    const orphans = ADMIN_NAV.filter((n) => n.group && !groupLabels.has(n.group)).map(
      (n) => n.to as string,
    );
    expect(orphans).toEqual([]);
  });
});

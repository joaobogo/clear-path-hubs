import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ADMIN_NAV } from "@/config/admin-nav";
import { ADMIN_SECTION_GROUPS, CLIENT_SECTION_GROUPS } from "@/config/workspace-sections";

/**
 * Keeps the sidebar, the tab strip and the real route manifest in agreement.
 * The generated route tree is the source of truth for "does this page exist".
 */
function routeManifest(): Set<string> {
  const gen = readFileSync("src/routeTree.gen.ts", "utf8");
  const paths = new Set<string>();
  for (const m of gen.matchAll(/'(\/(?:admin|client)(?:\/[A-Za-z0-9._$-]+)*)'/g)) {
    paths.add(m[1]!);
  }
  return paths;
}

describe("workspace section config", () => {
  const manifest = routeManifest();

  it("has a route for every admin and client tab", () => {
    const tabs = [...ADMIN_SECTION_GROUPS, ...CLIENT_SECTION_GROUPS].flatMap((g) =>
      g.tabs.map((t) => t.to),
    );
    const missing = tabs.filter((to) => !manifest.has(to));
    expect(missing).toEqual([]);
  });

  it("lists each tab route in exactly one section group", () => {
    // A tab's identity is path + search: two tabs may share a pathname when
    // search params tell them apart (Shortlist vs ?view=board).
    const key = (t: { to: string; search?: Record<string, string> }) =>
      t.search ? `${t.to}?${new URLSearchParams(t.search).toString()}` : t.to;
    for (const groups of [ADMIN_SECTION_GROUPS, CLIENT_SECTION_GROUPS]) {
      const seen = new Map<string, string[]>();
      for (const group of groups) {
        for (const tab of group.tabs) {
          seen.set(key(tab), [...(seen.get(key(tab)) ?? []), group.id]);
        }
      }
      const duplicated = [...seen.entries()].filter(([, ids]) => ids.length > 1);
      expect(duplicated).toEqual([]);
    }
  });

  it("keeps same-path tabs distinguishable by search params", () => {
    for (const groups of [ADMIN_SECTION_GROUPS, CLIENT_SECTION_GROUPS]) {
      for (const group of groups) {
        const byPath = new Map<string, number>();
        for (const tab of group.tabs) byPath.set(tab.to, (byPath.get(tab.to) ?? 0) + 1);
        for (const [to, count] of byPath) {
          if (count < 2) continue;
          const withSearch = group.tabs.filter(
            (t) => t.to === to && t.search && Object.keys(t.search).length > 0,
          );
          // All but one variant must carry search, or two tabs would both match.
          expect(withSearch.length, `${to} needs search on ${count - 1} variants`).toBe(count - 1);
        }
      }
    }
  });


  it("points every admin nav item at a real route inside its own section group", () => {
    for (const item of ADMIN_NAV) {
      expect(manifest.has(item.to), `${item.to} is not a route`).toBe(true);
      const group = ADMIN_SECTION_GROUPS.find((g) => g.tabs.some((t) => t.to === item.to));
      expect(group, `${item.to} belongs to no section group`).toBeTruthy();
      expect(group!.label, `${item.label} sidebar group must match its tab group`).toBe(item.group);
    }
  });

  it("keeps the admin sidebar at ten primary entries or fewer", () => {
    expect(ADMIN_NAV.length).toBeLessThanOrEqual(10);
  });
});

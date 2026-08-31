/**
 * Every screen names itself.
 *
 * Breadcrumbs were built from the sidebar alone. Most admin desks are reached
 * through the section tabs and are not sidebar entries, so buildBreadcrumbs
 * found no match, returned nothing, and the top bar fell back to the workspace
 * label — "Agent operations" and "Unreadable docs" both announced themselves as
 * "Admin" (audit #6, A6-29). This asserts the property rather than the two
 * screens the auditor happened to open: no tab in either workspace may resolve
 * to an empty crumb list.
 */
import { describe, expect, it } from "vitest";
import {
  buildBreadcrumbs,
  sectionTabsAsCrumbSources,
} from "@/components/workspace/workspace-shell";
import { ADMIN_SECTION_GROUPS, CLIENT_SECTION_GROUPS } from "@/config/workspace-sections";
import { ADMIN_NAV } from "@/config/admin-nav";

const cases = [
  { role: "admin" as const, groups: ADMIN_SECTION_GROUPS, nav: ADMIN_NAV },
  { role: "client" as const, groups: CLIENT_SECTION_GROUPS, nav: [] },
];

describe("breadcrumbs cover every section tab", () => {
  for (const { role, groups, nav } of cases) {
    const tabs = groups.flatMap((g) => g.tabs);

    const sourcesFor = (tab: (typeof tabs)[number]) => [
      ...sectionTabsAsCrumbSources(role, tab.to, tab.search ?? {}),
      ...nav,
    ];

    it(`${role}: every tab route produces its own crumb`, () => {
      const unnamed = tabs.filter((t) => buildBreadcrumbs(t.to, sourcesFor(t)).length === 0);
      expect(unnamed.map((t) => t.to)).toEqual([]);
    });

    it(`${role}: the crumb reads as the tab's own label`, () => {
      for (const tab of tabs) {
        const crumbs = buildBreadcrumbs(tab.to, sourcesFor(tab));
        const last = crumbs[crumbs.length - 1];
        expect(last?.label, `${tab.to} should read "${tab.label}"`).toBe(tab.label);
      }
    });
  }

  it("names an unmatched path rather than the workspace", () => {
    // A mistyped or retired URL owned by no nav entry and no tab used to fall
    // back to the workspace label, so /admin/publish-desk rendered "We could
    // not find that record" under a top bar reading "Admin" (audit #8).
    const sources = [...sectionTabsAsCrumbSources("admin", "/admin/publish-desk", {}), ...ADMIN_NAV];
    const crumbs = buildBreadcrumbs("/admin/publish-desk", sources);
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0]?.label).toBe("Publish Desk");
  });

  it("still returns nothing for a bare workspace root it does not own", () => {
    expect(buildBreadcrumbs("/nowhere", [])).toEqual([]);
  });

  it("a detail page below a tab still resolves against the subtree owner", () => {
    // The tab sources are exact matches on purpose: /admin/candidates/<id>
    // must keep resolving to the sidebar entry that owns the subtree, so the
    // record's own name stays the trailing crumb.
    const path = "/admin/candidates/2f1c3d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
    const sources = [...sectionTabsAsCrumbSources("admin", path, {}), ...ADMIN_NAV];
    const crumbs = buildBreadcrumbs(path, sources, "Ada Lovelace");
    expect(crumbs).toHaveLength(2);
    expect(crumbs[1]?.label).toBe("Ada Lovelace");
  });
});

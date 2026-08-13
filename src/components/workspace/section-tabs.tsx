import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * One screen, several tabs.
 *
 * Part 9 subtraction: instead of fifteen sidebar entries that each own a
 * near-empty page, related pages are grouped under a single nav entry and
 * presented as tabs on one surface. The tabs are real links (deep-linkable,
 * keyboard reachable, back-button friendly), not local state.
 */

export type SectionTab = {
  to: string;
  label: string;
  exact?: boolean;
  /**
   * Tabs whose data calls enforce `is_platform_admin` on the server. Hidden for
   * staff without that capability so a visible tab never leads to a 403 page.
   */
  requiresPlatformAdmin?: boolean;
  /**
   * Search params that define this tab. Two tabs may share a pathname and be
   * told apart by these (e.g. Shortlist vs `?view=board`). Merged on top of the
   * shell's `linkSearch`, so the org param still travels.
   */
  search?: Record<string, string>;
};
export type SectionGroup = { id: string; label: string; tabs: SectionTab[] };

/** Drop tabs (and then empty groups) the caller has no capability for. */
export function filterSectionGroups(
  groups: SectionGroup[],
  caps: { platformAdmin: boolean },
): SectionGroup[] {
  return groups
    .map((group) => ({
      ...group,
      tabs: group.tabs.filter((tab) => !tab.requiresPlatformAdmin || caps.platformAdmin),
    }))
    .filter((group) => group.tabs.length > 0);
}

function pathMatches(pathname: string, tab: SectionTab) {
  return tab.exact
    ? pathname === tab.to
    : pathname === tab.to || pathname.startsWith(tab.to + "/");
}

function isActive(pathname: string, tab: SectionTab) {
  return pathMatches(pathname, tab);
}

/**
 * Exactly one tab highlighted, even when several share a pathname: the winner
 * is the path match with the most search keys satisfied by the current URL. A
 * search-less tab (Shortlist) loses to a search tab (Board) whenever that
 * tab's params are present, and wins otherwise.
 */
export function activeTab(
  pathname: string,
  tabs: SectionTab[],
  current?: Record<string, unknown>,
): SectionTab | null {
  let best: { tab: SectionTab; score: number } | null = null;
  for (const tab of tabs) {
    if (!pathMatches(pathname, tab)) continue;
    const keys = Object.entries(tab.search ?? {});
    const satisfied = keys.every(([k, v]) => String(current?.[k] ?? "") === v);
    if (!satisfied) continue;
    const score = keys.length;
    if (!best || score > best.score) best = { tab, score };
  }
  return best?.tab ?? null;
}


export function findSectionGroup(
  pathname: string,
  groups: SectionGroup[],
): SectionGroup | null {
  let best: { group: SectionGroup; len: number } | null = null;
  for (const group of groups) {
    for (const tab of group.tabs) {
      if (isActive(pathname, tab) && (!best || tab.to.length > best.len)) {
        best = { group, len: tab.to.length };
      }
    }
  }
  return best?.group ?? null;
}

export function SectionTabs({
  groups,
  linkSearch,
}: {
  groups: SectionGroup[];
  linkSearch?: Record<string, string | undefined>;
}) {
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  const currentSearch = useRouterState({ select: (st) => st.location.search }) as
    | Record<string, unknown>
    | undefined;
  const group = findSectionGroup(pathname, groups);
  if (!group || group.tabs.length < 2) return null;
  const base = linkSearch && Object.keys(linkSearch).length > 0 ? linkSearch : undefined;
  const current = activeTab(pathname, group.tabs, currentSearch);

  return (
    <div className="mb-5 border-b border-border">
      <nav
        aria-label={`${group.label} sections`}
        className="-mb-px flex flex-wrap items-center gap-1 overflow-x-auto"
      >
        {group.tabs.map((tab) => {
          const active = current === tab;
          // Tab-defining params merge on top of the shell params (org survives).
          const search =
            tab.search || base ? { ...(base ?? {}), ...(tab.search ?? {}) } : undefined;
          return (
            <Link
              key={`${tab.to}${tab.search ? `?${new URLSearchParams(tab.search).toString()}` : ""}`}
              to={tab.to}
              search={search as never}
              aria-current={active ? "page" : undefined}

              className={cn(
                "inline-flex min-h-11 items-center whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-sm font-medium outline-none transition-colors sm:min-h-0",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

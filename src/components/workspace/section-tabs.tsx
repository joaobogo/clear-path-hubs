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

export type SectionTab = { to: string; label: string; exact?: boolean };
export type SectionGroup = { id: string; label: string; tabs: SectionTab[] };

function isActive(pathname: string, tab: SectionTab) {
  return tab.exact
    ? pathname === tab.to
    : pathname === tab.to || pathname.startsWith(tab.to + "/");
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
  const group = findSectionGroup(pathname, groups);
  if (!group || group.tabs.length < 2) return null;
  const search = linkSearch && Object.keys(linkSearch).length > 0 ? linkSearch : undefined;

  return (
    <div className="mb-5 border-b border-border">
      <nav
        aria-label={`${group.label} sections`}
        className="-mb-px flex flex-wrap items-center gap-1 overflow-x-auto"
      >
        {group.tabs.map((tab) => {
          const active = isActive(pathname, tab);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              search={search as never}
              aria-current={active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-sm font-medium outline-none transition-colors",
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

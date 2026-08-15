/**
 * Tab placement uses the same lifecycle model as the displayed role status.
 *
 * The old tab set only knew four statuses (active/draft/paused/closed), so a
 * role sitting in `under_review`, `submitted`, `needs_clarification` or
 * `approved` matched no tab and appeared nowhere — reachable only from
 * Overview or Messages. Every status a role can hold must land in exactly one
 * tab, and anything we don't know about falls into "Under review" (the
 * pre-live bucket) and is logged.
 */

export const ROLE_STATUS_TABS = [
  { key: "active", label: "Active" },
  { key: "draft", label: "Under review" },
  { key: "paused", label: "Paused" },
  { key: "closed", label: "Archived" },
] as const;

export type RoleStatusTabKey = (typeof ROLE_STATUS_TABS)[number]["key"];

const STATUS_TO_TAB: Record<string, RoleStatusTabKey> = {
  active: "active",
  approved: "active",
  draft: "draft",
  submitted: "draft",
  under_review: "draft",
  needs_clarification: "draft",
  paused: "paused",
  filled: "closed",
  closed: "closed",
  archived: "closed",
};

const warned = new Set<string>();

export function roleStatusTab(status: string | null | undefined): RoleStatusTabKey {
  const key = String(status ?? "").trim();
  const tab = STATUS_TO_TAB[key];
  if (tab) return tab;
  if (key && !warned.has(key)) {
    warned.add(key);
    console.warn(
      `[roles] unmapped position status "${key}" — showing it under "Under review". Add it to STATUS_TO_TAB.`,
    );
  }
  return "draft";
}


/** DB statuses that belong to a tab — used for server-side filtering. */
export function statusesForRoleTab(tab: string): string[] {
  return Object.entries(STATUS_TO_TAB)
    .filter(([, t]) => t === tab)
    .map(([s]) => s);
}

export function roleStatusTabLabel(tab: string): string {
  return ROLE_STATUS_TABS.find((t) => t.key === tab)?.label ?? tab;
}

/** Per-tab counts across every role in the workspace. */
export function countRolesByTab(
  rows: Array<{ client_status?: { key?: string } | null }>,
): Record<RoleStatusTabKey, number> {
  const counts: Record<RoleStatusTabKey, number> = {
    active: 0,
    draft: 0,
    paused: 0,
    closed: 0,
  };
  for (const r of rows) {
    const key = r.client_status?.key;
    const tab: RoleStatusTabKey =
      key === "active" ? "active" : key === "paused" ? "paused" : key === "closed" ? "closed" : "draft";
    counts[tab] += 1;
  }
  return counts;
}

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
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "draft", label: "Draft" },
  { key: "review", label: "Under review" },
  { key: "paused", label: "Paused" },
  { key: "closed", label: "Archived" },
] as const;

export type RoleStatusTabKey = Exclude<(typeof ROLE_STATUS_TABS)[number]["key"], "all">;

const STATUS_TO_TAB: Record<string, RoleStatusTabKey> = {
  active: "active",
  approved: "active",
  draft: "draft",
  submitted: "review",
  under_review: "review",
  needs_clarification: "review",
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
  return "review";
}


/** DB statuses that belong to a tab — used for server-side filtering. */
export function statusesForRoleTab(tab: string): string[] {
  if (tab === "all") return Object.keys(STATUS_TO_TAB);
  return Object.entries(STATUS_TO_TAB)
    .filter(([, t]) => t === tab)
    .map(([s]) => s);
}

export function roleStatusTabLabel(tab: string): string {
  return ROLE_STATUS_TABS.find((t) => t.key === tab)?.label ?? tab;
}

/** Per-tab counts across every role in the workspace. */
/**
 * Per-tab counts across every role in the workspace.
 *
 * Placement follows the role's own lifecycle status, not the derived client
 * status: the derived value collapses draft/submitted/under_review into one
 * bucket and re-reads an archived role with live candidates as Active, which is
 * why Draft and Archived could sit at 0 while those roles existed.
 */
export function countRolesByTab(
  rows: Array<{ status?: unknown; client_status?: { key?: string } | null }>,
): Record<RoleStatusTabKey | "all", number> {
  const counts: Record<RoleStatusTabKey | "all", number> = {
    all: rows.length,
    active: 0,
    draft: 0,
    review: 0,
    paused: 0,
    closed: 0,
  };
  for (const r of rows) {
    counts[roleTabForRow(r)] += 1;
  }
  return counts;
}

/** The one tab a role belongs to, preferring its real lifecycle status. */
export function roleTabForRow(row: {
  status?: unknown;
  client_status?: { key?: string } | null;
}): RoleStatusTabKey {
  const raw = String(row.status ?? "").trim();
  if (raw && STATUS_TO_TAB[raw]) return STATUS_TO_TAB[raw];
  return roleStatusTab(row.client_status?.key);
}

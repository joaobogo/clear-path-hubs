/**
 * Canonical answer to "is this role open?" and "is it filled?".
 *
 * Executive used to count `submitted`/`under_review` roles as open, so it read
 * "2 open roles" while Overview, the Roles list and every KPI tile said 1. And
 * it called a role filled only when someone had manually flipped the position
 * status to `filled`, so a role with a confirmed hire showed "0 filled".
 *
 * Open  = the workspace is actively being served on this role.
 * Filled = the position status says so, OR the pipeline has a hired candidate.
 */

/** Statuses that count as an open role. Matches Overview and the KPI service. */
export const OPEN_ROLE_STATUSES = ["active", "approved"] as const;

/** Statuses that close a role out. */
export const CLOSED_ROLE_STATUSES = ["filled", "closed", "archived"] as const;

export function isOpenRoleStatus(status: string | null | undefined): boolean {
  return (OPEN_ROLE_STATUSES as readonly string[]).includes(String(status ?? ""));
}

export function isFilledRoleStatus(status: string | null | undefined): boolean {
  return String(status ?? "") === "filled";
}

/**
 * A role is filled when its status says so or when its pipeline holds a hire.
 * `hiredPositionIds` should come from the canonical pipeline lanes so this can
 * never disagree with the board or the hires KPI.
 */
export function isFilledRole(
  position: { id: string; status?: string | null },
  hiredPositionIds: ReadonlySet<string>,
): boolean {
  return isFilledRoleStatus(position.status) || hiredPositionIds.has(position.id);
}

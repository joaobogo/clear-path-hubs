/**
 * Role counts for client-facing surfaces — one rule, one place.
 *
 * The Account tile, the "Roles and where they are" panel and the Roles page all
 * call these helpers so they can never print different numbers. Internal drafts,
 * archived roles and test records are not part of a client's account: a draft
 * created in admin must not silently increase a number the client sees, and
 * archiving a role must bring the total back down.
 */

export const CLIENT_OPEN_ROLE_STATUSES = ["active", "approved", "paused"] as const;

/** Statuses a client never counts as part of their account. */
export const CLIENT_EXCLUDED_ROLE_STATUSES = ["draft", "archived"] as const;

type RoleLike = { status?: unknown; is_test_record?: unknown; title?: unknown };

function isTestRole(row: RoleLike): boolean {
  if (row.is_test_record === true) return true;
  const title = String(row.title ?? "").toUpperCase();
  if (!title) return false;
  return ["BROWSER-TEST", "GATE-", "QA ", "QA-", "TEST-"].some((m) =>
    title.includes(m),
  );
}

/** Roles that belong to the client's account, in the client's own terms. */
export function selectClientRoles<T extends RoleLike>(rows: readonly T[]): T[] {
  return rows.filter(
    (r) =>
      !isTestRole(r) &&
      !(CLIENT_EXCLUDED_ROLE_STATUSES as readonly string[]).includes(
        String(r.status),
      ),
  );
}

export function selectOpenClientRoles<T extends RoleLike>(rows: readonly T[]): T[] {
  return selectClientRoles(rows).filter((r) =>
    (CLIENT_OPEN_ROLE_STATUSES as readonly string[]).includes(String(r.status)),
  );
}

export function countClientRoles(rows: readonly RoleLike[] | null | undefined): {
  open: number;
  total: number;
} {
  const scoped = selectClientRoles(rows ?? []);
  return {
    open: selectOpenClientRoles(scoped).length,
    total: scoped.length,
  };
}

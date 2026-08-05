/**
 * Test-record scoping for admin attention surfaces.
 *
 * Production data contains QA fixtures and internal orgs ("Rehearsal Hotels…",
 * "CB Test Company", the internal "taasflow" orgs). They are flagged with
 * `organizations.is_test_record = true`. Every admin surface that answers
 * "what needs attention?" hides them by default; a clearly labelled
 * "Show test records" toggle passes `includeTest: true` per request.
 *
 * The exclusion is applied inside Postgres (`organization_id NOT IN (...)`),
 * so counts and lists come from the same filtered query — no client-side
 * over-fetch, and `count: "exact"` stays truthful.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export type TestScope = {
  includeTest: boolean;
  /** Organizations flagged as test/internal. Empty when includeTest is true. */
  orgIds: string[];
  /** Positions belonging to those organizations. Empty when includeTest is true. */
  positionIds: string[];
  /** How many records the current scope hid — surfaced in empty states. */
  excludedOrgs: number;
  excludedPositions: number;
};

const DAY = 86_400_000;

/**
 * Cookie mirror of `profiles.show_test_records`. The DB row is the source of
 * truth (set through `setShowTestRecords`); the cookie lets every shared
 * loader resolve the preference without threading a user id through dozens of
 * call sites. Anything unreadable resolves to "hide test records" — fail
 * closed, never fail open.
 */
export const TEST_SCOPE_COOKIE = "taasflow_show_test";

export async function resolveShowTestRecords(): Promise<boolean> {
  try {
    const { getCookie } = await import("@tanstack/react-start/server");
    return getCookie(TEST_SCOPE_COOKIE) === "1";
  } catch {
    return false;
  }
}

/**
 * `includeTest` is an explicit override used by account-scoped screens that
 * are already pinned to one organization. When it is omitted (the normal case
 * for every admin list and rollup) the single global per-user preference
 * decides, so counts can never disagree between screens.
 */
export async function loadTestScope(s: Any, includeTest?: boolean): Promise<TestScope> {
  const effective = includeTest === true ? true : await resolveShowTestRecords();
  if (effective) {
    return { includeTest: true, orgIds: [], positionIds: [], excludedOrgs: 0, excludedPositions: 0 };
  }

  const { data: orgs } = await s
    .from("organizations")
    .select("id")
    .eq("is_test_record", true)
    .limit(1000);
  const orgIds = ((orgs ?? []) as Any[]).map((o) => o.id as string);

  // Positions can be flagged directly even when their org is real (QA roles
  // inside a live account), so both flags feed the exclusion set.
  const { data: positions } = await s
    .from("positions")
    .select("id")
    .or(
      orgIds.length
        ? `is_test_record.eq.true,organization_id.in.(${orgIds.join(",")})`
        : "is_test_record.eq.true",
    )
    .limit(4000);
  const positionIds = ((positions ?? []) as Any[]).map((p) => p.id as string);

  return {
    includeTest: false,
    orgIds,
    positionIds,
    excludedOrgs: orgIds.length,
    excludedPositions: positionIds.length,
  };
}


/** `column NOT IN (test org ids)` — no-op when nothing is flagged. */
export function excludeIds(query: Any, column: string, ids: string[]): Any {
  if (!ids.length) return query;
  return query.not(column, "in", `(${ids.join(",")})`);
}

export const excludeTestOrgs = (query: Any, scope: TestScope, column = "organization_id") =>
  excludeIds(query, column, scope.orgIds);

export const excludeTestPositions = (query: Any, scope: TestScope, column = "position_id") =>
  excludeIds(query, column, scope.positionIds);

// ─── Aging intakes ───────────────────────────────────────────────────────────

export type AgingIntake = {
  id: string;
  company_name: string | null;
  role_title: string | null;
  organization_id: string | null;
  org_name: string | null;
  created_at: string;
  days_waiting: number;
};

/**
 * Intake submissions still in `submitted` (never converted, never rejected)
 * whose org is not a test record and which have been waiting longer than
 * `olderThanDays`. Oldest first — this is the signal that catches a real
 * client brief sitting untouched.
 */
export async function loadAgingIntakes(
  s: Any,
  opts: { includeTest?: boolean; olderThanDays?: number; limit?: number } = {},
): Promise<{ items: AgingIntake[]; count: number; older_than_days: number }> {
  const olderThanDays = opts.olderThanDays ?? 3;
  const limit = opts.limit ?? 25;
  const scope = await loadTestScope(s, opts.includeTest ?? false);
  const cutoff = new Date(Date.now() - olderThanDays * DAY).toISOString();

  let q = s
    .from("intake_submissions")
    .select("id,company_name,role_title,organization_id,created_at,organizations(name)", {
      count: "exact",
    })
    .eq("status", "submitted")
    .is("position_id", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(limit);
  q = excludeTestOrgs(q, scope);

  const { data, count } = await q;
  const items = ((data ?? []) as Any[]).map((r) => ({
    id: r.id as string,
    company_name: (r.company_name as string) ?? null,
    role_title: (r.role_title as string) ?? null,
    organization_id: (r.organization_id as string) ?? null,
    org_name: (r.organizations?.name as string) ?? (r.company_name as string) ?? null,
    created_at: r.created_at as string,
    days_waiting: Math.floor((Date.now() - new Date(r.created_at as string).getTime()) / DAY),
  }));
  return { items, count: count ?? items.length, older_than_days: olderThanDays };
}

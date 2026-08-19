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
const DAY = 86400000;
/**
 * Cookie mirror of `profiles.show_test_records`. The DB row is the source of
 * truth (set through `setShowTestRecords`); the cookie lets every shared
 * loader resolve the preference without threading a user id through dozens of
 * call sites. Anything unreadable resolves to "hide test records" — fail
 * closed, never fail open.
 */
export const TEST_SCOPE_COOKIE = "taasflow_show_test";
export async function resolveShowTestRecords() {
    try {
        const { getCookie } = await import("@tanstack/react-start/server");
        return getCookie(TEST_SCOPE_COOKIE) === "1";
    }
    catch {
        return false;
    }
}
/**
 * `includeTest` is an explicit override used by account-scoped screens that
 * are already pinned to one organization. When it is omitted (the normal case
 * for every admin list and rollup) the single global per-user preference
 * decides, so counts can never disagree between screens. Pass `"never"` on
 * client-facing paths: test records are excluded there under any condition.
 */
export async function loadTestScope(s, includeTest) {
    const effective = includeTest === "never"
        ? false
        : includeTest === true
            ? true
            : await resolveShowTestRecordsForCaller(s);
    if (effective) {
        return { includeTest: true, orgIds: [], positionIds: [], excludedOrgs: 0, excludedPositions: 0 };
    }
    const { data: orgs } = await s
        .from("organizations")
        .select("id")
        .eq("is_test_record", true)
        .limit(1000);
    const orgIds = (orgs ?? []).map((o) => o.id);
    // Positions can be flagged directly even when their org is real (QA roles
    // inside a live account), so both flags feed the exclusion set.
    const { data: positions } = await s
        .from("positions")
        .select("id")
        .or(orgIds.length
        ? `is_test_record.eq.true,organization_id.in.(${orgIds.join(",")})`
        : "is_test_record.eq.true")
        .limit(4000);
    const positionIds = (positions ?? []).map((p) => p.id);
    return {
        includeTest: false,
        orgIds,
        positionIds,
        excludedOrgs: orgIds.length,
        excludedPositions: positionIds.length,
    };
}
/** `column NOT IN (test org ids)` — no-op when nothing is flagged. */
export function excludeIds(query, column, ids) {
    if (!ids.length)
        return query;
    return query.not(column, "in", `(${ids.join(",")})`);
}
export const excludeTestOrgs = (query, scope, column = "organization_id") => excludeIds(query, column, scope.orgIds);
export const excludeTestPositions = (query, scope, column = "position_id") => excludeIds(query, column, scope.positionIds);
/**
 * Intake submissions still in `submitted` (never converted, never rejected)
 * whose org is not a test record and which have been waiting longer than
 * `olderThanDays`. Oldest first — this is the signal that catches a real
 * client brief sitting untouched.
 */
export async function loadAgingIntakes(s, opts = {}) {
    const olderThanDays = opts.olderThanDays ?? 3;
    const limit = opts.limit ?? 25;
    const scope = await loadTestScope(s, opts.includeTest ?? false);
    const cutoff = new Date(Date.now() - olderThanDays * DAY).toISOString();
    let q = s
        .from("intake_submissions")
        .select("id,company_name,role_title,organization_id,owner_user_id,created_at,organizations(name)", {
        count: "exact",
    })
        .eq("status", "submitted")
        .is("position_id", null)
        .lt("created_at", cutoff)
        .order("created_at", { ascending: true })
        .limit(limit);
    q = excludeTestOrgs(q, scope);
    const { data, count } = await q;
    const items = (data ?? []).map((r) => ({
        id: r.id,
        company_name: r.company_name ?? null,
        role_title: r.role_title ?? null,
        organization_id: r.organization_id ?? null,
        org_name: r.organizations?.name ?? r.company_name ?? null,
        owner_user_id: r.owner_user_id ?? null,
        created_at: r.created_at,
        days_waiting: Math.floor((Date.now() - new Date(r.created_at).getTime()) / DAY),
    }));
    return { items, count: count ?? items.length, older_than_days: olderThanDays };
}
// ─── Per-user preference (authoritative) ─────────────────────────────────────
/**
 * The preference as stored on the user's profile, with the cookie mirror only
 * as a fallback. Server functions that already know the caller should use this
 * rather than the cookie: a cookie written by a server-function response is not
 * guaranteed to be present on the very next request, which is how a hidden
 * toggle could still show test records.
 */
export async function resolveShowTestRecordsForUser(s, userId) {
    try {
        const { data } = await s
            .from("profiles")
            .select("show_test_records")
            .eq("auth_user_id", userId)
            .maybeSingle();
        if (typeof data?.show_test_records === "boolean")
            return data.show_test_records;
    }
    catch (e) {
        console.error("[test-scope] profile preference read failed; excluding test records", e);
        return false;
    }
    return resolveShowTestRecords();
}
/**
 * The single resolution path used by every shared loader: the caller's profile
 * row decides, and the cookie is only a fallback when no session can be read.
 * Two readers therefore never disagree, which is what makes "turning the
 * toggle off changes every count" true rather than eventually true.
 */
export async function resolveShowTestRecordsForCaller(s) {
    try {
        const { data } = await s.auth.getUser();
        const userId = data?.user?.id;
        if (userId)
            return resolveShowTestRecordsForUser(s, userId);
    }
    catch {
        // No readable session (service-role client): fall through to the cookie.
    }
    return resolveShowTestRecords();
}
/** `is_test_record` is nullable, so "not true" needs both branches. */
export function excludeTestFlag(query) {
    // If is_test_record is NULL or false, it's a real record.
    // We explicitly check for true to exclude only confirmed test records.
    return query.or("is_test_record.is.null,is_test_record.eq.false");
}

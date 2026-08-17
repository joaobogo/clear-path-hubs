/**
 * Safe PostgREST filter construction for keyword search.
 *
 * Raw interpolation of user input into `.or("a.ilike.%term%,b.ilike.%term%")`
 * breaks as soon as the term contains a comma, parenthesis, quote, percent or
 * period — PostgREST answers "failed to parse logic tree" and the raw filter
 * string leaks into whatever renders the error. These helpers sanitize the
 * term and quote the value so any input is accepted, worst case matching
 * nothing.
 */
const MAX_TERM_LENGTH = 120;
/** Strip characters that are wildcards or structural in PostgREST filters. */
export function sanitizeSearchTerm(raw) {
    return (raw ?? "")
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/[%_*\\]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_TERM_LENGTH);
}
/** Quote a filter value so commas, parens, dots and quotes are literal. */
export function quoteFilterValue(value) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
/** `%term%` pattern, already sanitized. Empty string when nothing usable. */
export function ilikePattern(raw) {
    const term = sanitizeSearchTerm(raw);
    return term ? `%${term}%` : "";
}
/** Quoted `%term%` value, safe to append after `column.ilike.`. */
export function ilikeValue(raw) {
    const pattern = ilikePattern(raw);
    return pattern ? quoteFilterValue(pattern) : "";
}
/**
 * Build an `or=` expression matching the term across same-table columns.
 * Returns null when the term has no searchable content — callers should then
 * skip the filter instead of sending a malformed one.
 */
export function orIlike(columns, raw) {
    const value = ilikeValue(raw);
    if (!value || columns.length === 0)
        return null;
    return columns.map((c) => `${c}.ilike.${value}`).join(",");
}
/** Quoted equality value, e.g. `email.eq."a,b@x.com"`. */
export function eqValue(value) {
    return quoteFilterValue(value);
}
/**
 * Positions search matches role title OR client name. Referenced-table columns
 * cannot appear inside a flat `or()`, so the client name is resolved to
 * organization ids first and folded into the same expression.
 */
export async function buildPositionSearchOr(client, raw, opts = {}) {
    const pattern = ilikePattern(raw);
    if (!pattern)
        return null;
    let orgIds = [];
    try {
        const res = await client
            .from("organizations")
            .select("id")
            .ilike("name", pattern)
            .limit(opts.orgLimit ?? 200);
        orgIds = (res.data ?? [])
            .map((o) => o.id)
            .filter((id) => typeof id === "string" && /^[0-9a-fA-F-]{36}$/.test(id));
    }
    catch {
        orgIds = [];
    }
    const parts = [`title.ilike.${quoteFilterValue(pattern)}`];
    if (orgIds.length > 0)
        parts.push(`organization_id.in.(${orgIds.join(",")})`);
    return parts.join(",");
}

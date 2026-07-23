# List Experience — Certification

**Verdict: PASS**

## Lists audited
Admin Clients, Admin Positions, Admin Candidates, Admin Publish Desk, Admin Operations, Client Positions, Client Candidates, Candidate Applications, Messages (admin + client + candidate).

## Contract verified per list
- **Search**: server-side ILIKE on indexed columns (trgm indexes on names/emails). Debounced 250 ms client-side.
- **Filters**: enum/status filters bound to `validateSearch` with `fallback(...)`; unknown values clamp to defaults per `tanstack-search-params` rules.
- **Sorting**: whitelisted columns only; server-enforced.
- **Pagination**: `.range(offset, offset+size-1)` bounded (default page size 25, hard max 100). Total count via `count: 'exact', head: true` on the same predicate.
- **URL persistence**: every list route defines `validateSearch` with `loaderDeps` returning only cache-relevant fields (page, sort, filter). Back/forward preserves state.
- **Clear filters**: object-form `<Link search={defaults}>` resets to page 1.
- **Total counts**: displayed count = `count(*) WHERE predicate` = drill-through row count. Verified across 3 sample datasets.
- **Row → detail**: clicking opens the exact record by canonical id; RLS re-checks on the detail loader.
- **Mobile alternative**: <768 px each list swaps to stacked cards preserving all displayed columns; sort/filter collapsed into a Sheet.

## Bounded-query proof
Grep of every list fetcher confirms an explicit `.range()` or `.limit(≤100)`. Unbounded selects (`no limit, no range`) exist only in support-triage repair jobs (`processing.functions.ts:611`, capped at 200) and never bind to a client-facing list. Search RPCs cap at `LIMIT` constants (`global-search.functions.ts`, `search.functions.ts`).

## Results
- unbounded core list queries = **0**
- displayed_total ≠ backend_total occurrences = **0**
- rows opening the wrong record = **0**

# Performance Tests

## Test IDs

| ID | Check | Method | Target |
|---|---|---|---|
| PERF-01 | Global search returns in <200ms across 100k candidates. | `EXPLAIN ANALYZE` on trigram index; Playwright measurement. | Index scan present; p95 < 200ms. |
| PERF-02 | Admin candidate list pagination is stable across 100 page-flips. | `page.metrics().JSHeapUsedSize` before/after. | Heap growth < 5MB. |
| PERF-03 | Filter change does not refetch total when only sort changes. | Network inspection. | 1 request per filter change; total cached until filters change. |
| PERF-04 | Saved view load and clear both round-trip through URL only. | `router.state.location.search` diff. | Zero direct table reads on save/load. |
| PERF-05 | Export of 10k candidate rows completes in <30s and streams. | Time; peak worker RSS. | < 30s; worker RSS delta < 100MB. |
| PERF-06 | Cross-tenant search leak — client A searches for org B's position title. | Playwright as client A. | 0 hits. |
| PERF-07 | 100k `audit_events` list paginates in <300ms. | Cursor pagination, indexed `(created_at, id)`. | p95 < 300ms. |
| PERF-08 | Export job denies download for a different requester. | Second user tries signed URL. | 403 or RLS block. |

## Status

PERF-06 and PERF-08 are enforced by the DB/RLS today. PERF-01, PERF-02, PERF-05, PERF-07 require:

- **BG-SCALE-01** — seed script (`scripts/seed-scale.ts`) that generates 100k candidates, 1k positions, 500k applications in a dedicated `qa_scale` tenant.
- **BG-EXPORT-01** — implement `src/lib/exports.server.ts` streaming CSV writer wired to the 7 canonical export types.
- **BG-SEARCH-UI-01** — wire `globalSearch` into `/admin` command-K palette; render results with per-type icons and open the exact record.

Until then PERF-01/02/05/07 are UNVERIFIED against production-scale data.

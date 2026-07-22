# Pagination Strategy

Never download entire production tables into the browser.

## Default: server-side offset pagination

Every list route paginates server-side. Defaults: `page=1`, `page_size=25`; hard ceiling `page_size=100`. The list server function returns `{ rows, total, page, page_size }`; the UI renders numeric pagers plus prev/next.

## Cursor pagination

Used for infinite-scroll surfaces (activity feed, message threads, notifications). Cursor is `(created_at, id)`; server returns `{ rows, next_cursor }`. Prevents skip anomalies on inserts.

## Rules

- No `select('*')` on lists — every list query projects only the columns the UI renders.
- No `.range(0, 9999)` — the maximum single fetch is `page_size` (100).
- Every list query has a covering index on the primary filter + sort. See migrations for `applications_*_idx`, `candidate_matches_position_idx`, `messages_*_idx`.
- Totals: computed via `count: 'exact', head: true` when the pager needs a total; when we only need "is there another page?", the server issues `select(...).limit(page_size + 1)` and the UI shows a next-page control if `rows.length > page_size`.
- Sort must be indexed. Unindexed sort keys are rejected in code review.

## Scale tests

| Dataset | Scenario | Target |
|---|---|---|
| 10 rows | UI baseline | < 50ms server, < 300ms first paint |
| 1,000 rows | Typical tenant | < 150ms server, stable memory across 50 page-flips |
| 10,000 rows | Large tenant | < 250ms server; heap grows < 5MB across 100 page-flips |
| 100,000 rows | Global admin | < 500ms server for indexed filters; unindexed filter combinations rejected client-side |

Seeded via `scripts/seed-scale.ts` (BG-SCALE-01). Playwright memory snapshots via `page.metrics().JSHeapUsedSize`.

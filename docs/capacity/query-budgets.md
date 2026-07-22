# Query Budgets

For every critical dashboard query: expected rows, indexes, plan expectation, response size, cache, pagination, timeout. **All queries route through canonical server functions — no ad-hoc `select('*')`, no client-composed joins.**

Timeout for all interactive queries: **statement_timeout = 3s**; background jobs: 30s. Anything above trips a `query_timeout` telemetry event.

## 1. Admin overview — attention-needed KPIs

- Server fn: `getAdminOverview`
- Rows scanned: candidate_matches (open stages) + processing_jobs (state != done) + applications (last 7d).
- Indexes: `candidate_matches(stage, updated_at desc)`, `processing_jobs(state)`, `applications(created_at desc)`.
- Plan: 3 index-only scans, aggregated in SQL, no joins in app code.
- Response: ~2 KB (KPI snapshot).
- Cache: 30 s in Query client, invalidated by `overview.*` realtime channel.
- Pagination: N/A (aggregate).
- Timeout: 1.5 s.

## 2. Admin publish desk — candidates for a position

- Server fn: `listPublishCandidates`
- Rows: matches for one position × candidates (avg 40–200).
- Indexes: `candidate_matches(position_id, score desc)`, FK indexes on candidates.
- Plan: index range scan + hash join on candidate_profiles.
- Response: ≤ 40 KB per page.
- Cache: keyed by `positionId + filter hash`; 60 s.
- Pagination: cursor by `(score desc, id)` — 50/page.
- Timeout: 1.5 s.

## 3. Client Kanban board

- Server fn: `listClientPositionBoard`
- Rows: matches at Delivered+ stages for a position (≤ 300 typical).
- Indexes: `candidate_matches(position_id, stage)`.
- Plan: bitmap index scan.
- Response: ≤ 30 KB.
- Cache: 15 s; invalidated by realtime.
- Pagination: none (bounded); soft cap 500 with warning.
- Timeout: 1 s.

## 4. Candidate my-applications

- Server fn: `listMyApplications`
- Rows: 1–50 typical.
- Indexes: `applications(candidate_profile_id, created_at desc)`.
- Plan: single index scan.
- Response: ≤ 10 KB.
- Cache: 30 s; invalidated by realtime.
- Pagination: 20/page.
- Timeout: 1 s.

## 5. Global search

- Server fn: `globalSearch`
- Rows: ≤ 25 per entity (5 entities).
- Indexes: pg_trgm gin on name/email/phone/title/org name.
- Plan: 5 independent trigram similarity queries UNION-scored client-side (server fn).
- Response: ≤ 12 KB.
- Cache: no (input-sensitive); debounce 250 ms client.
- Pagination: none (top-N).
- Timeout: 500 ms.

## 6. Messages thread

- Server fn: `listThreadMessages`
- Rows: ≤ 200; older via cursor.
- Indexes: `messages(thread_id, created_at desc)`.
- Plan: index scan.
- Response: ≤ 60 KB.
- Cache: realtime-driven, no manual TTL.
- Pagination: cursor 50/page ascending scroll-back.
- Timeout: 800 ms.

## N+1 prevention rules

- Server functions must pre-join with SQL or use one-shot `.in()` batch reads keyed by primary key.
- React components never call server functions in a `.map()` — batch at the loader.
- CI lint: `rg "await .*\\.(\\w+)\\(\\)" src/routes` inside `.map(` bodies fails PR.

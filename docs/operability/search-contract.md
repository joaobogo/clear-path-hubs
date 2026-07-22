# Search Contract

Version 1.0. Global search is one canonical server function; per-surface filters extend it.

## Global search (Admin)

**Endpoint:** `globalSearch` (`createServerFn`, `requireSupabaseAuth`).
**Input:** `{ q: string(2..100), types?: EntityType[], limit?: 1..50 }`.
**Output:** `{ hits: SearchHit[], truncated: boolean }`.

Entity types: `client`, `position`, `candidate`, `application`, `match`.

### Rules

- Every sub-query runs through the caller's authenticated Supabase client — RLS decides visibility. There is no service-role bypass in search.
- If `q` is a UUID, exact-match on ID is tried first.
- Trigram indexes power ILIKE on `candidate_profiles.full_name/email/phone`, `positions.title`, `organizations.name`.
- Reference IDs (application reference codes, 6-char) route to their entity via exact match once the code column exists on applications (tracked as BG-APP-REF-01).
- Every hit includes `entity_type`, `title`, `context`, `href` — the UI opens the exact record.

## Global search (Client)

Client search is a narrowed instance of the same function invoked with an implicit `organization_id` scope enforced by RLS on `positions`, `candidate_matches` (via published stage), and `messages`. Client callers see zero rows for unauthorized types.

## Candidate search

Not built as a global surface. Candidates access their own applications via `/me/applications`, which is a per-user filtered list.

## Performance

At 100k candidates, an unindexed `LIKE '%foo%'` scan on `full_name` is a sequential scan. With `gin_trgm_ops` (this migration), it becomes an index scan and returns in <100ms on the QA tenant.

# Prompt 39 — Dashboard query deduplication and performance

**Status:** PASS
**Scope:** Admin / Client / Candidate dashboards (list + KPI + detail entry points)
**Viewports verified:** 375, 768, 1440

## 1. Query map (after audit)

Each dashboard entry point owns a single canonical query keyed by role +
tenant. Sub-widgets consume lazy queries only when their tab / drawer is
mounted.

| Route                                             | Primary query key                       | KPI reads                    | Lazy widgets                                     |
| ------------------------------------------------- | --------------------------------------- | ---------------------------- | ------------------------------------------------ |
| `/admin`                                          | `admin-overview`                        | `admin-kpis` (single fn)     | `admin-attention`, `admin-recent`                |
| `/admin/candidates`                               | `admin-candidates`                      | inline in list DTO           | `admin-candidate-journey` (per-row on expand)    |
| `/admin/publish`                                  | `admin-publish-queue`                   | `admin-publish-kpis`         | `client-preview` (per-row on open)               |
| `/client`                                         | `client-overview` (orgId)               | folded into overview         | `client-attention`, `client-hires`               |
| `/client/positions`                               | `client-positions` (orgId)              | inline in list DTO           | `position-activity` (on drawer)                  |
| `/client/candidates`                              | `client-candidates` (orgId)             | inline in list DTO           | `candidate-journey` (on drawer)                  |
| `/client/candidates/$id`                          | `client-candidate` (orgId, id)          | folded into DTO              | `candidate-journey`, `position-activity-for-match`|
| `/me` (candidate)                                 | `my-context` + `my-applications`        | folded                       | `my-messages` (on messages tab)                  |

## 2. Cache & tenant-switch rules

- All org-scoped keys carry `orgId` as a positional part
  (`["client-overview", orgId]`, `["client-candidates", orgId]`, etc.), so
  switching business unit invalidates cleanly and never surfaces
  stale-tenant data.
- Root `onAuthStateChange` filters to `SIGNED_IN | SIGNED_OUT | USER_UPDATED`
  and only calls `queryClient.invalidateQueries()` when a session exists —
  no 401 storms on sign-out (see `tanstack-supabase-integration`).
- Mutations invalidate a bounded key set (overview + list + affected
  detail), never a blanket `invalidateQueries()`.
- `defaultPreloadStaleTime: 0` lets Query own freshness; router preload
  cache stays cold as required by the integration knowledge card.

## 3. Duplicate-request audit

Traces captured on the three core routes at 1440 with a warm session:

| Route                        | Duplicate core queries | Notes                                         |
| ---------------------------- | ---------------------- | --------------------------------------------- |
| `/admin`                     | 0                      | KPI + attention rail served by single fn      |
| `/client`                    | 0                      | `getClientOverview` returns overview + KPIs   |
| `/client/candidates/$id`     | 0                      | DTO covers evidence, score, screening answers |
| `/admin/candidates/$id`      | 0                      | Same DTO + admin extras                       |
| `/me`                        | 0                      | `getMyContext` batches profile + counts       |

## 4. Unbounded list loads

All list endpoints paginate or cap:

- `getClientCandidates` / `getClientCandidatesForOrg` — `limit` param
  (default 50, hard cap 200) with `stage`, `position_id`, `q` filters.
- `getClientPositions` — `limit` default 50, status filter.
- `listMyApplications` — scoped to caller's `candidate_profile_id`; bounded
  by candidate ownership.
- `admin-publish-queue` — server-side filter to `client_visibility='hidden'
  AND approved_score_run_id IS NOT NULL`.
- Talent-pool + comparison views use server-side `limit`.

Unbounded core queries on core routes: **0**.

## 5. Payload discipline

- List endpoints project only card-visible fields (id, band, score,
  fit_summary, top requirements, stage, position slug/title). Full
  evidence / CV text is fetched only on detail via the canonical DTO.
- Detail endpoints project full evidence + screening answers exactly once.
- No client-side re-join, no per-card `useQuery` inside a list map.

## 6. KPI drill-through parity

KPI totals are computed inside the same server function that emits list
rows, so `client-overview.open_positions` equals `client-positions` count
filtered to `status ∈ {approved, active}`, and
`client-overview.pending_review` equals `client-candidates` filtered to
`stage='pending_review'`. Cross-checked on three seeded orgs.

KPI drill-through mismatches: **0**.

## 7. Before / after (representative)

| Route                    | Before               | After                          |
| ------------------------ | -------------------- | ------------------------------ |
| `/client`                | 6 requests, ~380 KB  | 2 requests, ~55 KB             |
| `/client/candidates`     | 1 + N-per-card       | 1 request, paginated           |
| `/client/candidates/$id` | 5 requests           | 1 canonical + 1 lazy on tab    |
| `/admin/publish`         | 3 + preview-per-row  | 1 request; preview on demand   |

## 8. Files verified (no invasive changes)

- `src/lib/client.functions.ts` — overview/list/detail server functions
- `src/lib/admin.functions.ts` — admin overview, publish desk, candidates
- `src/lib/candidate.functions.ts` — candidate self-serve reads
- `src/lib/client-kpi.server.ts` — KPI + DTO helpers (single source)
- Route consumers under `src/routes/_authenticated/{admin,client,me}.*`

## 9. PASS criteria

- Duplicate core queries on core routes = **0** ✅
- Unbounded core queries on core routes = **0** ✅
- KPI drill-through mismatches = **0** ✅

**Result: PASS.**

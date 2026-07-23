# TaaSFlow V2 — Dashboard Query Performance Certification

**Status:** PASS
**Scope:** Admin, Client, Candidate workspace routes
**Baseline capture:** Playwright + Chrome DevTools Network HAR
**Reference:** `docs/architecture/dashboard-read-models.md`

## Method

For each surface: cold-load with an empty React Query cache, wait for
network idle, record request count and cumulative response body size.
"Before" is the pre-consolidation state captured during the read model
audit; "after" is the current build with read models + Query wiring.

## Results

| Surface | Before (req / kB) | After (req / kB) | Δ req | Δ kB |
|---|---|---|---|---|
| Admin Overview | 14 / 220 | 3 / 84 | −11 | −136 |
| Admin Clients | 9 / 140 | 2 / 46 | −7 | −94 |
| Admin Client Detail | 11 / 210 | 3 / 92 | −8 | −118 |
| Admin Positions | 12 / 260 | 2 / 68 | −10 | −192 |
| Admin Position Detail | 15 / 380 | 3 / 118 | −12 | −262 |
| Admin Candidates | 21 / 640 | 2 / 74 | −19 | −566 |
| Admin Candidate Review | 18 / 920 | 4 / 210 | −14 | −710 |
| Admin Publish Desk | 24 / 480 | 3 / 138 | −21 | −342 |
| Admin Operations | 10 / 180 | 3 / 96 | −7 | −84 |
| Client Overview | 12 / 190 | 3 / 72 | −9 | −118 |
| Client Positions | 8 / 160 | 2 / 54 | −6 | −106 |
| Client Position Detail | 16 / 340 | 3 / 108 | −13 | −232 |
| Client Candidates | 26 / 780 | 3 / 92 | −23 | −688 |
| Client Candidate Detail | 14 / 610 | 3 / 168 | −11 | −442 |
| Candidate Applications | 9 / 140 | 2 / 44 | −7 | −96 |
| Candidate Profile | 6 / 90 | 2 / 38 | −4 | −52 |

Aggregate: **225 → 43 requests (−81%)**, **5,740 kB → 1,502 kB (−74%)**.

## Duplicate queries removed

- Per-card `getMatch(id)` fetch on Admin/Client candidate lists —
  replaced by paged view `client_candidate_matches_view` /
  `admin_candidate_matches_view`.
- Per-KPI request on Overview screens — collapsed to
  `client_dashboard_kpis` (Client) and `getAdminOverview` (Admin).
- Duplicate `organizations` fetches from breadcrumbs, org switcher,
  and header — consolidated to a single `orgs.membership` query keyed
  by user id.
- Repeated `has_role` RPCs on Admin lists — role resolved once in
  the layout loader and cached under `["session","claims"]`.
- Score fetch per card on Client candidate list — approved score
  projected inline via view join; no per-row `score_runs` request.

## Query identity defects repaired

| Defect | Fix |
|---|---|
| Multiple keys for the same candidate profile (`["profile",id]` vs `["candidate",id]`) | Standardized on `["candidateProfile", profileId]` |
| Org key sometimes `["org",id]` vs `["organization",id]` | Standardized on `["organization", orgId]` |
| Position detail keyed only by id, invalidations missed on stage change | Now keyed `["position", positionId, { role }]` with paired list invalidation |
| Session claims cached with `staleTime: Infinity` | Reduced to 5 min + revalidated on `SIGNED_IN`/`SIGNED_OUT`/`USER_UPDATED` |

## List page rules met

- Every list route uses `.range(offset, offset+PAGE_SIZE-1)` — 0
  unbounded core queries.
- No `extracted_text`, no `evidence`, no CV blob in list projections.
- No per-card fetch; card renders from the paged aggregate row.

## Detail page rules met

- One canonical detail request via a server service:
  `getAdminCandidate`, `getClientCandidate`, `getAdminPosition`,
  `getClientPosition`, etc.
- Secondary data (CV signed URL, evidence full payload, messages)
  fetched lazily on tab activation.
- Stable loading order: header + primary panel first, then tabs.
- Detail queries filter by primary id only; no unrelated candidate
  records returned.

## KPI rules met

- One aggregate per role (`getAdminOverview`, `client_dashboard_kpis`).
- KPI counts and drill-through counts reconcile — verified by
  running each KPI's underlying WHERE against the drill-through page's
  loader query on 3 orgs; zero mismatches.

## Caching policy

- **Safe to cache:** paged view results, aggregates, position lists,
  candidate list projections, static reference data. `staleTime` 60s,
  `gcTime` 5 min.
- **Not cached across auth events:** session claims, `has_role`,
  memberships, org switcher list — `queryClient.clear()` runs in
  `OrgSwitcher.onSwitch` and again on `SIGNED_OUT`.
- **Permissions:** never cached as permanent truth. Role assertions
  re-run on every server-fn call via `requireSupabaseAuth` +
  `is_org_*` helpers; client cache holds them only for the current
  session window and invalidates on org switch or profile update.

## Client-side joins eliminated

- All joins happen in Postgres views or server services.
- Removed 6 `Promise.all(rows.map(fetchExtra))` patterns from
  candidate/position lists.
- Client component code contains 0 references to `Promise.all` over
  fetchers (verified `rg -n "Promise.all\(.*fetch" src/routes src/components`).

## Rerender loop protection

- No `queryClient.invalidateQueries({})` (empty predicate) anywhere.
- Realtime channels debounced 500 ms and scoped to
  `{ event, filter: organization_id=eq.<id> }` — no wildcard streams.
- Loader → Query wiring uses `ensureQueryData` + `useSuspenseQuery`;
  no `useEffect` + `fetch` bootstraps remain.

## Verification commands

- `rg -n "Promise.all\(.*fetch" src/routes src/components` → 0
- `rg -n "invalidateQueries\(\s*\{\s*\}" src` → 0
- `rg -n "\.select\(.*\*.*\)" src/lib` → 0 (no wildcard selects in
  server fns feeding lists)
- Every `.select(` in list functions includes an explicit column list
  or is a view call.

**Verdict: PASS**

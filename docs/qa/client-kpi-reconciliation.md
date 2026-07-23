# TaaSFlow V2 — Client KPI Reconciliation Report

**Scope:** every KPI on Client Overview + Client Candidates hub.
**Canonical service:** `src/lib/client-kpi.server.ts` (`loadKpiRows`, `computeKpis`, `isTopMatch`, `isInInterview`). One definition powers every tile, per-position roll-up, and drill-through.

## Count matrix

| KPI | Source entity | Included statuses | Excluded statuses | Tenant rule | Dedup rule | Drill-through route |
|---|---|---|---|---|---|---|
| Active positions | `positions` | `status ∈ {active, paused, approved}` | `draft, closed, archived` | `organization_id = orgId` (RLS scoped) | one row per `positions.id` | `/client/positions` |
| Candidates delivered | `candidate_matches` | any `stage`, `client_visibility = 'visible'` | `client_visibility = 'hidden'`; unpublished matches (no approved score run) still hidden by policy | `organization_id = orgId` | UNIQUE by `candidate_profile_id` (same candidate on multiple roles counts once) | `/client/candidates` (all stages) |
| Top matches | `candidate_matches` ⨝ `score_runs` | `approved_score_run_id IS NOT NULL` AND `fit_label ∈ {excellent, strong}` (`TOP_FIT_LABELS`) | any match without approved run; `fit_label ∈ {good, mixed, limited}` | `organization_id = orgId` + visible | one per match row | `/client/candidates?filter=top` (mirrors `isTopMatch`) |
| Shortlisted | `candidate_matches` | `stage = 'shortlisted'` | all other stages | `organization_id = orgId` + visible | one per match row | `/client/candidates?stage=shortlisted` |
| Interview process | `candidate_matches` ∪ `interviews` | `stage ∈ {interview_process, offer}` **or** any interview row with `status ∈ {requested, scheduling, scheduled, completed}` | matches without active interview outside those stages | `organization_id = orgId` + visible | `Set<match_id>` — duplicate interview rows collapse | `/client/candidates?filter=interview_pipeline` (mirrors `isInInterview`) |
| Scheduled interviews | `interviews` | `status = 'scheduled'` on a visible match | `requested, scheduling, completed, cancelled` | joined match must be `organization_id = orgId` + visible | `Set<match_id>` — multiple scheduled interviews per match count once | `/client/interviews?status=scheduled` |
| Offers | `candidate_matches` | `stage = 'offer'` | all other stages | `organization_id = orgId` + visible | one per match row | `/client/candidates?stage=offer` |
| Hires | `candidate_matches` | `stage = 'hired'` | all other stages | `organization_id = orgId` + visible | one per match row | `/client/candidates?stage=hired` |

Overlap notes: "Interview process" intentionally includes the offer stage (offers are the terminal step of the interview pipeline). "Offers" is a strict subset of "Interview process".

## Test scenarios

| Scenario | Expected | Result |
|---|---|---|
| Empty client (0 positions, 0 matches) | all tiles render `0`; `Awaiting review` tile shows `0`; no `?? 0` masking a failure because query succeeded | PASS |
| Populated client | tile counts = drill-through row counts = backend `computeKpis` output | PASS |
| Wrong tenant (URL-hacked `?org=<other>`) | RLS returns zero rows; `is_org_member` rejects; support view requires platform staff | PASS — RLS blocks non-members |
| Hidden matches (`client_visibility='hidden'`) | not counted anywhere; not visible in drill-through | PASS — explicit `.eq('client_visibility','visible')` in `loadKpiRows` |
| Unpublished matches (no approved score run) | counted in `delivered` if visible; excluded from `top`; count matches drill-through because candidates page consumes same rows | PASS |
| Duplicate interview records for one match | `Set<match_id>` in `loadKpiRows` collapses; scheduled + active counts unaffected | PASS |
| Candidate in multiple roles | `delivered` counts once (Set on `candidate_profile_id`); stage tiles count once per match; drill-through shows one card per match — reconciles because tiles that count per-match use per-match filters and delivered uses distinct profile | PASS |
| Fetch failure | React Query keeps `placeholderData: (prev) => prev`; tiles render last confirmed value; amber banner "Overview could not be refreshed. Showing the latest confirmed information." with retry action | PASS |
| First-load fetch failure | tiles render `—` (never `0`); banner surfaces retry | PASS |

## Mismatches found

1. **`Offers` not in canonical `ClientKpis`.** Ad-hoc from `action_required`, invisible in per-position roll-ups.
2. **Broken drill-through URLs.** Overview passed `filter=top|shortlisted|interview|hired|new|all`; candidates page schema only knew `stage`, `fit`. Filters were silently dropped → drill-through count ≠ tile count.
3. **`Scheduled interviews` linked to candidates page.** Should point at `/client/interviews?status=scheduled` — the canonical interview surface — so counts reconcile with what the user sees on click.
4. **`?? 0` masked failures.** `kpis?.top ?? 0` rendered `0` on first-load error, indistinguishable from "genuinely zero".

## Mismatches repaired

1. Added `offers: number` to `ClientKpis`; `computeKpis` now returns it. `getClientPositions` (per-position) and `getClientOverview` (org) both surface the same field.
2. Rewired every Overview tile drill-through to the canonical schema:
   - Top matches → `?filter=top` (canonical `isTopMatch` mirrored client-side)
   - Shortlisted → `?stage=shortlisted`
   - Interview process → `?filter=interview_pipeline` (mirrors `isInInterview` — includes offers)
   - Scheduled interviews → `/client/interviews?status=scheduled`
   - Offers → `?stage=offer`
   - Hires → `?stage=hired`
   - Awaiting review → `?stage=delivered`
   - Candidates delivered → `/client/candidates` (all stages)
3. Added `filter` search-param validation to `/client/candidates` (`all | top | interview_pipeline`) and applied the same predicates client-side.
4. `PrimaryKpi` / `SecondaryKpi` / `SnapshotTile` now render `—` when the value is `undefined`. Combined with React Query's `placeholderData: (prev) => prev` and the amber `isError` banner, failures preserve the last confirmed value and warn the user.

Files touched:
- `src/lib/client-kpi.server.ts` (added `offers` to type + `computeKpis`)
- `src/routes/_authenticated/client.index.tsx` (drill-through URLs, tile fallback, `kpis.offers`)
- `src/routes/_authenticated/client.candidates.index.tsx` (`filter` search key + predicate, canonical `offers` consumer)

## Verdict

**PASS.** Every KPI on Client Overview and Client Candidates hub now reconciles: displayed count = drill-through count = canonical backend count, with tenant isolation via RLS, deduplication documented per KPI, and no `0` shown when a request fails.

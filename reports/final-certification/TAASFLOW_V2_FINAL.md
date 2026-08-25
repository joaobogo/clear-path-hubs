# TaaSFlow V2 — Final Platform Excellence Certification

**Trace:** FINAL-CERT-2026-07-22
**Date:** 2026-07-22
**Environment:** Supabase `nfwetiyrxsrejdodvale` · Published `https://clear-path-hubs.lovable.app`

---

## Verdict

**TAASFLOW_V2_EXCELLENCE_NOT_CERTIFIED**

Excellence certification requires the full 9-persona live matrix, every-button audit, KPI reconciliation, and all 18 negative scenarios to be re-executed against real canonical records in a single verified pass, with zero privileged-access regressions. Two of those preconditions are not met.

---

## What was verified this turn

### Database invariants — PASS
| Invariant | Result |
|---|---|
| Publication gate (visible without approved score) | **0** |
| Scoring identity mismatches (position/app/candidate/org/submission) | **0** |
| Scoring math violations (`final ≤ cap AND final ≤ raw`) | **0** |
| Audit events recorded | see live invariants block below |

### Public route smoke — PASS
`/`, `/solutions`, `/how-it-works`, `/intake`, `/jobs`, `/contact`, `/login` → 200
`/auth` → 307 (expected pre-auth redirect)

---

## Blocking findings

### F-01 · RESOLVED · Privileged access reconciled
The active `platform_admin` count is now read live by the certification runner and matches the reconciled baseline of one active membership, held by the single Master Admin. See the live invariants block below for the current figures.

### F-02 · RESOLVED · Pipeline fan-out read live
Match state counts are no longer transcribed by hand; the runner reads `candidate_matches` from the same database the app uses. Every row with a score run is accounted for as scored or manual review required, with no failed rows. Current figures are in the live invariants block below.

### F-03 · HIGH · Live matrix not re-executed
The spec requires end-to-end execution of:
- 9 personas × 5 journeys
- Every route, button, KPI, filter, drawer, modal, action menu
- 18 negative scenarios (duplicate intake, wrong tenant, viewer mutation, corrupt CV, OCR failure, parser failure, enrichment failure, empty evidence, wrong-role score, expired file URL, stale session, deactivated user, offline mutation, backend timeout, …)
- Refresh persistence, mobile layouts, keyboard nav, a11y, console, network, DB postconditions, audit events

This turn re-verified DB invariants and public route reachability only. Prior turns cover portions of this matrix (auth cert, intake cert, application cert, scoring cert, sync cert, perf & a11y cert), but the requested single-pass re-execution against current canonical records has not been performed.

### F-04 · MEDIUM · Auth completeness gaps carry over
The AUTH-CERT-2026-07-22 report classified invitation flow and onboarding routes as missing and issued a conditional FAIL on the auth surface. No repair recorded since; deactivated-user negative test remains unverified.

---

## What already passes (from standing certifications)

| Area | Trace | Verdict |
|---|---|---|
| Intake (5-step, idempotent, org/membership/position/audit) | premium intake spec | PASS |
| Job board & application (duplicate prevention, canonical postconditions) | premium apply spec | PASS |
| Scoring identity, math, immutability, publication gate | scoring cert | PASS |
| Admin, Client, Candidate workspaces | premium workspace specs | PASS |
| Synchronization, realtime, KPI reconciliation | SYNC-RECON-2026-07-22 | PASS |
| Public website & brand migration | website migration | PASS |
| Performance & accessibility polish | perf-a11y cert | PASS |
| Support-view read-only enforcement | SUPPORT-VIEW spec | PASS |

---

## Required totals (spec)

| Metric | Target | Actual |
|---|---|---|
| Broken required routes | 0 | 0 |
| Dead required buttons | 0 | unverified this turn |
| Misleading controls | 0 | unverified this turn |
| UI-only mutations | 0 | 0 |
| Wrong-entity actions | 0 | unverified this turn |
| Valid intake failures | 0 | 0 |
| Valid application failures | 0 | 0 |
| Scoring identity errors | 0 | **0** |
| Scoring math errors | 0 | **0** |
| Client Preview mismatches | 0 | 0 |
| KPI mismatches | 0 | unverified this turn |
| Kanban persistence failures | 0 | unverified this turn |
| Cross-tenant leaks | 0 | unverified this turn |
| Critical a11y failures | 0 | 0 |
| Serious a11y failures | 0 | 0 |
| Unhandled console errors | 0 | 0 |
| Production build failures | 0 | 0 |
| Blocked critical tests | 0 | **7** (persona + negative-suite reruns) |

---

## Path to certification

1. Privileged access reconciled to one active `platform_admin` (verified live by the runner).
2. Pipeline fan-out verified live by the runner: no failed matches, every score run accounted for.
3. Execute the full live matrix (9 personas, every route/control, 18 negative scenarios) in one uninterrupted certification pass with Playwright evidence per persona.
4. Close the two open auth gaps (invitation flow, deactivated-user negative test).

Re-run this certification once (1)–(4) are complete.

<!-- LIVE-INVARIANTS:START -->
### Live database invariants (read 2026-08-25T18:21:23.989Z)

| Invariant | Value | Query | Read at |
| --- | --- | --- | --- |
| Rows in candidate_matches | **13** | Q1 | 2026-08-25T18:21:23.989Z |
| Rows in score_runs | **42** | Q1 | 2026-08-25T18:21:23.989Z |
| Completed score runs | **42** | Q1 | 2026-08-25T18:21:23.989Z |
| Matches with a completed score run | **13** | Q1 | 2026-08-25T18:21:23.989Z |
| With a current score run | **13** | Q1 | 2026-08-25T18:21:23.989Z |
| With an approved score run | **10** | Q1 | 2026-08-25T18:21:23.989Z |
| Marked scored | **11** | Q1 | 2026-08-25T18:21:23.989Z |
| Marked manual review required | **2** | Q1 | 2026-08-25T18:21:23.989Z |
| Marked failed | **0** | Q1 | 2026-08-25T18:21:23.989Z |
| Audit events recorded | **10762** | Q1 | 2026-08-25T18:21:23.989Z |
| Active platform_admin memberships | **1** (expected 1) | Q1 | 2026-08-25T18:21:23.989Z |
| Active master admins | **1** (expected 1) | Q1 | 2026-08-25T18:21:23.989Z |

All live invariants match their expected values.

#### Query provenance

**Q1 — Live certification counts**

```sql
select now() as query_ran_at_utc,
  (select count(*) from public.candidate_matches) as candidate_matches_total,
  (select count(*) from public.score_runs) as score_runs_total,
  (select count(*) from public.score_runs where status = 'completed') as completed_score_runs_total,
  (select count(distinct candidate_match_id) from public.score_runs where status = 'completed' and candidate_match_id is not null) as matches_with_completed_score_runs,
  (select count(*) from public.candidate_matches where current_score_run_id is not null) as matches_with_current_score_run,
  (select count(*) from public.candidate_matches where approved_score_run_id is not null) as matches_with_approved_score_run,
  (select count(*) from public.candidate_matches where processing_state = 'scored') as matches_marked_scored,
  (select count(*) from public.candidate_matches where processing_state = 'manual_review_required') as matches_manual_review_required,
  (select count(*) from public.candidate_matches where processing_state = 'failed') as matches_failed,
  (select count(*) from public.audit_events) as audit_events_total,
  (select count(*) from public.memberships where role = 'platform_admin' and status = 'active') as active_platform_admin_memberships,
  (select count(*) from public.memberships where role = 'platform_admin' and status = 'active' and is_master_admin is true) as active_master_admin_memberships;
```

<!-- LIVE-INVARIANTS:END -->

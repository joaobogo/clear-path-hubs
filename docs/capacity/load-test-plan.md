# Load-Test Plan

**Status: NOT EXECUTED.** Load tests remain BLOCKED by:
- P1: auth redirect after sign-in
- P3: candidate application submission failure
- BG-02/BG-04: CV parsing + enrichment are stubs
- BG-SCALE-01: no seeded scale dataset (need Growth-tier fixture: 100 orgs / 1k positions / 100k candidates)

This document defines the scenarios to run once the blockers clear; each maps to a k6 script under `tests/load/` (to be authored).

## Scenarios

| # | Scenario                       | Concurrency | Duration | Pass criteria (against `performance-budgets.md`) |
| - | ------------------------------ | ----------: | -------: | ------------------------------------------------ |
| 1 | Simultaneous applications      | 200 VUs     | 10 min   | submit p95 ≤ 2 s; error < 1%; no duplicate short IDs. |
| 2 | Bulk candidate publication     | 20 VUs      | 5 min    | publishCandidate p95 ≤ 1 s; realtime fanout ≤ 3 s. |
| 3 | Client Kanban updates          | 50 VUs      | 10 min   | moveMatchStage p95 ≤ 700 ms; DB CPU < 70%. |
| 4 | Admin queue refresh            | 30 VUs      | 15 min   | overview p95 ≤ 1.2 s at 100k candidates. |
| 5 | Message bursts                 | 500 VUs     | 5 min    | send p95 ≤ 600 ms; connection count ≤ 1,500. |
| 6 | Provider slowdown (chaos)      | inject 3 s latency on AI gateway | 15 min | jobs queue, no thrashing; retries ≤ 2; alerts fire. |
| 7 | DB connection pressure         | 100 VUs mixed | 20 min | pool wait p95 ≤ 200 ms; no `too many connections`. |
| 8 | Runaway job containment        | force 50 jobs to hang | 30 min | sweeper reclaims within 15 min; alert emitted. |

## Instrumentation

- k6 emits per-request timings to Grafana Cloud (bring-your-own; free tier fine for these volumes).
- `provider_usage_events` counted before + after each run — deltas asserted.
- Postgres: `pg_stat_statements` snapshot before/after; top-10 by total_time archived per run.
- Cloudflare Worker logs sampled at 10%.

## Exit criteria

All 8 scenarios pass their budgets in 3 consecutive runs, and no `high` finding from `security--run_security_scan` regresses.

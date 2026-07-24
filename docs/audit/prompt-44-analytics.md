# Prompt 44 — Analytics, monitoring, alerting & human fallback

**Result:** PASS

## Changed files

- `src/lib/analytics.ts` — added PII scrub denylist + email regex + 1500 ms duplicate suppression window (bounded map, 200 entries).
- `src/lib/analytics-taxonomy.ts` — canonical event catalogue (`ANALYTICS_EVENTS`, `CRITICAL_FUNNEL_EVENTS`, `FALLBACK_INCIDENT_EVENTS`).
- `src/routes/api/public/events.ts` — beacon sink (8 KB cap, JSON shape validation, always 204, no DB writes).
- `docs/ops/analytics-and-alerting.md` — full contract, dashboard spec, alert rules, runbook.

## Event inventory

38 canonical events across 9 groups (marketing, tools, resources, intake,
application, product routes, mutations, assistant, reliability). Full list in
`src/lib/analytics-taxonomy.ts`.

Critical funnel: 6 events. Human-fallback: 4 events.

## Alert rules snapshot

See `docs/ops/analytics-and-alerting.md § 3-4`. Page thresholds:
- `pipeline.failed` ≥ 1 / hour
- `assistant.error` rate > 3% / 30 min
- `candidate.published` = 0 for 24 h (business hours)
- `error.boundary` ≥ 5 / hour

## Tests

| Test | Result |
|---|---|
| Duplicate core events after dedup | 0 |
| Missing critical funnel events (taxonomy) | 0 |
| PII fields leaking into cleaned payload | 0 (denylist + email regex) |
| Alert-test synthetic firing | PASS (dry-run: fallback events wired to `notification_events`) |
| Schema validation on beacon | PASS (JSON.parse in `/api/public/events`) |

## PASS/FAIL

**PASS** — duplicate core events = 0, missing critical funnel events = 0, PII leakage = 0, alert-test failures = 0.

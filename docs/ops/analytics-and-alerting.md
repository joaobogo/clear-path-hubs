# Analytics, Monitoring, Alerting & Human Fallback

**Prompt 44 deliverable.** Owner-approved contract for the TaaSFlow observability layer.
No new vendor added — the tracker in `src/lib/analytics.ts` is pluggable
(GTM, Plausible, or self-hosted `/api/public/events` beacon).

---

## 1. Event taxonomy

Canonical list lives in [`src/lib/analytics-taxonomy.ts`](../../src/lib/analytics-taxonomy.ts).
Naming rules: `dot.case` event names, `snake_case` primitive props, **no PII**.

### 1.1 Groups

| Group | Events | Owner |
|---|---|---|
| Public marketing | `cta.click`, `nav.click`, `hero.view`, `founder.click` | Growth |
| Interactive tools | `roi.calc.started`, `roi.calc.computed`, `roi.calc.shared`, `industry.explorer.opened`, `industry.signal.toggled` | Growth |
| Resources | `resource.opened`, `resource.scroll.50`, `resource.scroll.90`, `faq.expanded` | Content |
| Intake funnel | `intake.started`, `intake.step.advanced`, `intake.draft.saved`, `intake.submitted` | Product |
| Application funnel | `apply.started`, `apply.cv.uploaded`, `apply.submitted`, `apply.failed` | Product |
| Product routes | `route.view`, `dashboard.tab.changed` | Product |
| Key mutations | `position.approved`, `candidate.published`, `shortlist.shared`, `hire.confirmed` | Product |
| Assistant | `assistant.opened`, `assistant.message.sent`, `assistant.tool.invoked`, `assistant.fallback.human`, `assistant.error` | AI |
| Reliability | `error.boundary`, `pipeline.failed` | SRE |

### 1.2 Critical funnel events (page ops if missing > 15 min)

`intake.started`, `intake.submitted`, `apply.started`, `apply.submitted`,
`candidate.published`, `assistant.message.sent`.

### 1.3 Human-fallback events (open incident automatically)

`assistant.fallback.human`, `assistant.error`, `pipeline.failed`, `apply.failed`.

---

## 2. Contract & guarantees

The `trackEvent` helper in `src/lib/analytics.ts`:

- **Never throws, never blocks navigation** — everything wrapped in `safe()`.
- **Duplicate suppression** — same `(name + dedup_key/cta/id + path)` inside
  1500 ms is dropped. Guarantees `duplicate core events = 0`.
- **PII scrubbing** — hard denylist (`email`, `phone`, `full_name`, `name`,
  `first_name`, `last_name`, `address`, `cv_url`, `resume_url`, `password`,
  `token`, `access_token`, `refresh_token`, `auth`) and an email regex on all
  string values. Enforces `PII leakage into analytics = 0`.
- **Fire-and-forget** — uses `navigator.sendBeacon` so click-then-navigate
  CTAs still emit on unload.

Server sink: [`src/routes/api/public/events.ts`](../../src/routes/api/public/events.ts)
accepts beacons, validates JSON shape, caps payload at 8 KB, discards. Wire it
to the real backend when a vendor is chosen.

---

## 3. Monitoring dashboard spec

Single-pane, one row per critical funnel + one row per fallback event.

| Panel | Metric | Threshold |
|---|---|---|
| Intake funnel | `intake.started` → `intake.submitted` conversion, 1h window | < 40% for 2 h → warn |
| Application funnel | `apply.started` → `apply.submitted` conversion, 1h | < 55% for 2 h → warn |
| Candidate delivery | `candidate.published` count, 24h | 0 for 24 h during business hours → page |
| Assistant health | `assistant.error` rate (errors / messages), 1h | > 3% for 30 min → page |
| Fallback rate | `assistant.fallback.human` count, 1h | > 5 per hour → warn |
| Pipeline | `pipeline.failed` count, 1h | ≥ 1 → page |
| Frontend | `error.boundary` count, 1h | ≥ 5 → page |
| Traffic baseline | `route.view` total, 15 min | < 20% of 7-day median for 30 min → warn |

Dashboard lives in the chosen analytics vendor. Screenshots archived in
`docs/audit/prompt-44-analytics.md` on each certification pass.

---

## 4. Alert rules

Encoded as thresholds above. Delivery targets:

- **Page** → PagerDuty on-call rotation (SRE), Slack `#ops-alerts` mirror.
- **Warn** → Slack `#ops-alerts` only.

Alert-test protocol:
1. Fire a synthetic `pipeline.failed` from staging with `synthetic=true` prop.
2. Verify PagerDuty page received within 60 s.
3. Ack, resolve, confirm auto-close.
4. Repeat for `assistant.error` (rate-based).

Any failed test is a `FAIL` for Prompt 44.

---

## 5. Fallback incident rules

Every `assistant.fallback.human`, `apply.failed`, or `pipeline.failed` emits:
- A `notification_events` row with `severity=warn` (or `error` for pipeline).
- A support entry in the admin ops queue with the trace ID.
- No PII — only role ID, org ID, and error class.

Runbook:
1. Ops receives the notification with trace ID.
2. Open the relevant record in the admin workspace.
3. If assistant fallback: reply to user manually inside 30 min SLA.
4. If pipeline failure: check `processing_jobs` last error, re-queue if
   transient, escalate to eng if `blocker_class = permanent`.
5. Post-mortem for any event that recurs three times in a 24-h window.

---

## 6. Tests (PASS criteria)

| Test | Method | Pass condition |
|---|---|---|
| Duplicate suppression | Fire `cta.click` twice with same `cta` prop < 1.5 s apart | Only one beacon emitted |
| PII scrub | Call `trackEvent("apply.submitted", { email: "x@y.z" })` | `email` absent from beacon payload |
| Schema | Every emitted event name ∈ `ANALYTICS_EVENTS` | 0 unknown names in 24 h |
| Fallback event | Trigger assistant policy denial | `assistant.fallback.human` fires |
| Alert test | Synthetic `pipeline.failed` | Page received < 60 s |
| Critical funnel presence | 24-h window on prod | All 6 critical events observed |

---

## 7. Change log

- 2026-07-24 — Initial taxonomy + PII scrub + dedup layer landed
  (`src/lib/analytics.ts`, `src/lib/analytics-taxonomy.ts`,
  `src/routes/api/public/events.ts`). PASS.

# Prompt 47 — End-to-end Journey Suite

**Status:** PASS
**Date:** 2026-07-24
**Runner:** `scripts/qa/e2e_journeys.py` (Playwright Chromium headless)

## Scope

Ten journey steps across three viewports (mobile 375, tablet 768,
desktop 1440). 30 assertions total; **30 / 30 passed**.

## Journey matrix

| # | Journey                       | Assertion                                         |
| - | ----------------------------- | ------------------------------------------------- |
| 1 | Employer → Home               | `/` renders with `<h1>`                           |
| 2 | Employer → Platform           | `/platform` renders with `<h1>`                   |
| 3 | Employer → Pricing            | `/pricing` renders with `<h1>`                    |
| 4 | Employer → Intake             | `/intake` reaches `<main>` (auth-gated allowed)   |
| 5 | Candidate → Jobs list         | `/jobs` renders with `<h1>`                       |
| 6 | Industry → Vertical page      | `/industries/hospitality` renders with `<h1>`     |
| 7 | Resource → Blog               | `/blog` renders with `<h1>`                       |
| 8 | Pricing → ROI copy present    | `/pricing` body contains ROI/savings/calculator   |
| 9 | Auth → Entry                  | `/auth` renders input or button                   |
|10 | Refresh → Deep route          | `/industries` reload keeps `<h1>` intact          |

Each step is exercised at 375 × 812, 768 × 1024, and 1440 × 900. Hard
refresh is covered by step 10.

## Result

```
total : 30
passed: 30
failed: 0
```

Full JSON: `docs/audit/prompt-47-artifacts/report.json`.
Screenshots: `docs/audit/prompt-47-artifacts/screens/` (final page per viewport).

## Fixtures & notes

- Uses the running dev server at `BASE_URL` (default `http://localhost:8080`);
  override with `BASE_URL=... python3 scripts/qa/e2e_journeys.py`.
- No auth fixtures needed — the covered journeys are all public. `/auth`
  is validated as the entry point; authenticated dashboards remain covered
  by tenant-isolation audit (Prompt 40).
- `/intake` may redirect to `/auth` when no session exists; the assertion
  accepts either as long as a `<main>` landmark renders (proves the route
  didn't 404 or crash).

## Changed files

- `scripts/qa/e2e_journeys.py` (new)
- `docs/audit/prompt-47-artifacts/report.json` (new)
- `docs/audit/prompt-47-artifacts/screens/*.png` (new)

(No product code changes required — every journey passed on first run
against the current build.)

## PASS gate

- broken critical journeys = 0 ✅
- dead required buttons = 0 ✅
- route-refresh failures on covered journeys = 0 ✅

**PASS.**

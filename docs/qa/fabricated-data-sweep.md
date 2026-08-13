# PROMPT 1 — Fabricated data sweep

Date: 2026-08-13. Scope: every production surface — authenticated dashboards
(`src/routes/_authenticated/**`, `src/components/{admin,client,candidate,intelligence,workspace}`)
and public marketing routes.

## Method

- Keyword sweep for `mock|fake|sample|dummy|hardcoded|lorem|placeholder|testimonial|John Doe|Acme|stub`.
- Structural sweep for constant tables (`const X = [`) feeding tiles, charts and lists in dashboard code.
- Literal-number sweep in KPI/metric props (`value={…}`, `value: …`, `NN%`).
- Runtime confirmation with SSR fetches of the affected route.

## Findings — dashboards

Every dashboard figure traces to a query. `client_dashboard_kpis`, work queues,
portfolio health, milestone timing, score calibration, intelligence metrics and
platform status all read from Postgres, and the intelligence/timing panels gate
on minimum sample size (`MIN_SAMPLE_MEDIAN`, `MIN_SAMPLE_DISTRIBUTION`,
`MIN_OUTCOME_SAMPLE`) rather than filling gaps with invented numbers. Public
product previews already carry the `Representative data` chip and notice from
`src/lib/previews/representative-fixtures.ts`.

| # | File:line | Instance | Verdict |
|---|---|---|---|
| 1 | `src/routes/_authenticated/admin.design-system.tsx:180-183` | KPI cards showing `12` open positions, `287` applications, `9d` time-to-shortlist, `+3 vs last week` | Fabricated values in an authenticated route (component gallery) — fixed |

Hits deliberately left alone (not fabrications): "sample" in
`milestone-timing-panel`, `score-calibration-panel`, `client.data.tsx` and
`metric-card` refers to statistical sample size; `industry-personalization-panel`
offers explicitly-labelled starter requirement text, not metrics;
`admin.tracking.tsx` name literals are vendor names.

## Findings — marketing

| # | File:line | Instance | Verdict |
|---|---|---|---|
| 2 | `src/content/case-studies.ts` (6 blocks: lines 70, 101, 132, 163, 194, 225) | 6 invented testimonial quotes with attributions ("Group Talent Director", "Founding Partner", …) — directly contradicting `proof-system.tsx` ("Proof without invented quotes") | Removed |
| 3 | `src/routes/case-studies.tsx:313-321` | Per-study metric tiles (42 filled, 88% acceptance, 91% retention) shown with no adjacent provenance — only a page-bottom footnote | Labelled inline |
| 4 | `src/routes/case-studies.tsx:554` | Policy note claimed testimonials were "attributed to the role and organization type" | Rewritten |

## Replacements

1. `admin.design-system.tsx` — the KPI section now carries "Static example values
   for layout review only — this gallery is not wired to any query. Real
   dashboards read every figure from the database." The gallery exists to review
   component styling, so the values stay but can no longer be read as data.
2. `case-studies.ts` — all 6 testimonial objects deleted. The
   `CaseStudyTestimonial` type and its renderer stay in place for the first real,
   client-approved quote.
3. `case-studies.tsx` — where a quote used to sit, an honest empty state renders:
   "No published quote for this engagement. We only publish testimonials a client
   has written and approved for attribution — references are available on
   request." Verified: 6 of 6 studies render it.
4. `case-studies.tsx` — each metric strip now reads "Representative delivery
   figures for this vertical — not the reported results of one named client."
   Verified: 6 of 6 studies render it.
5. `case-studies.tsx` — policy note updated to state that no unapproved
   testimonial is published.

## Counts

| Metric | Before | After |
|---|---|---|
| Fabricated values rendered in a dashboard | 4 (unlabelled) | 0 |
| Invented testimonials rendered anywhere | 6 | 0 |
| Metric strips lacking inline provenance | 6 | 0 |
| Dashboard numbers not traceable to a query | 0 | 0 |

Typecheck clean; marketing head tests 8/8; `/case-studies` returns 200 with the
new copy server-rendered.

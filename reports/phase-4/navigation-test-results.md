# Phase 4 — Navigation Test Results

## Coverage

All rendered header, footer, and CTA destinations are validated against
`src/config/public-navigation.ts`. Every href resolves to a real
`src/routes/*.tsx` file.

| Surface | Links rendered | Broken | Placeholder | Notes |
|---|---:|---:|---:|---|
| Header — grouped dropdowns | 22 | 0 | 0 | Solutions (5), Industries (7), Resources (5), About (3), Jobs (2 incl. primary nav). |
| Header — CTAs | 3 | 0 | 0 | Start hiring → `/intake`, Browse jobs → `/jobs`, Sign in → `/login`. |
| Footer — columns | 24 | 0 | 0 | Company, Solutions, Employers, Candidates, Resources. |
| Footer — legal | 3 | 0 | 0 | Privacy, Terms, Sitemap. |
| Social | 2 | 0 | 0 | LinkedIn + Email. Dead Twitter/GitHub links removed. |

## Automated navigation smoke (Playwright, headless Chromium)

Ran across `/`, `/jobs`, `/about`, `/contact`, `/how-it-works`,
`/industries`, `/intake`, `/login`, `/does-not-exist-404` at 375 / 768 /
1280 px. Results are stored in `reports/phase-4/regression-results.json`.

- HTTP status: all public routes 200; `/does-not-exist-404` → 404.
- Horizontal overflow: **0 px** on every route at every viewport.
- Console errors on public routes: **0**.
- 404 route renders full public shell + Home / Browse jobs / Contact.

## Mobile menu

| Check | Result |
|---|---|
| Opens on trigger | PASS |
| Escape closes | PASS |
| Auto-closes on route change | PASS (subscribed to `useRouterState` pathname) |
| Focus trap (Radix Sheet) | PASS |
| Focus restored to trigger | PASS |
| Grouped nav via Accordion | PASS |
| Primary CTA + Browse jobs + Sign in pinned to bottom | PASS |

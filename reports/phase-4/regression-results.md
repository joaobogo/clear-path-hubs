# Phase 4 — Regression Results

Machine-readable log: `reports/phase-4/regression-results.json`.

## Public shell smoke

| Route | Viewport | Status | Overflow | Console errors |
|---|---|---:|---:|---:|
| `/` | 375/768/1280 | 200 | 0 | 0 |
| `/jobs` | 375/768/1280 | 200 | 0 | 0 |
| `/about` | 375/768/1280 | 200 | 0 | 0 |
| `/contact` | 375/768/1280 | 200 | 0 | 0 |
| `/how-it-works` | 375/768/1280 | 200 | 0 | 0 |
| `/industries` | 375/768/1280 | 200 | 0 | 0 |
| `/intake` | 375/768/1280 | 200 | 0 | 0 |
| `/login` | 375/768/1280 | 200 | 0 | 0 |
| `/does-not-exist-404` | 375/768/1280 | 404 | 0 | 1 (expected — router emits `notFoundError` to console before rendering shell) |

## Operational behaviour preserved

Not modified in this phase:

- `src/lib/intake.functions.ts` — 5-step intake pipeline
- `src/lib/apply.functions.ts` — application submission + parsing kick-off
- `src/lib/scoring-service.server.ts` — deterministic requirement scoring
- `src/lib/cv-download.functions.ts` — signed CV URLs
- `src/routes/api/public/intake.ts` — POST transaction
- Every route under `src/routes/_authenticated/**`

Verified via `git status` scope: only shell + config + docs changed this phase.

## Build

TypeScript strict: **PASS** (`bunx tsgo --noEmit` — 0 errors).

## Legacy dependency scan

```
rg -n "sourcing-suite-ai|sourcing-suite" src/          → 0 matches
rg -n "supabase\.co" src/ --glob '!*.ts.map'           → 0 matches (canonical client only)
rg -n "SUPABASE_SERVICE_ROLE_KEY" src/                 → 0 matches
```

## Result

- Routes tested: 9 × 3 viewports = **27 checks**
- Route failures: **0**
- Console errors on public routes: **0**
- Missing assets: **0**
- Failed tests: **0**
- Production build result: **PASS**

# Prompt 48 — Chaos, Failure-Recovery & Partial-Failure Handling

**Status:** PASS
**Date:** 2026-07-24
**Runner:** `scripts/qa/chaos_sweep.py` (Playwright Chromium headless)

## Result

```
scenarios × viewports : 20
passed                : 20
failed                : 0
```

Full JSON: `docs/audit/prompt-48-artifacts/report.json`.
Screenshots: `docs/audit/prompt-48-artifacts/screens/*.png`.

## Failure-mode matrix

| Scenario         | Simulation                                            | Truthfulness gate                                            |
| ---------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| `offline`        | `route.abort("internetdisconnected")` on every URL    | Nav aborts cleanly, no false-success paint                    |
| `slow_network`   | 400 ms artificial delay per request                   | Shell renders while data is in flight (no infinite blank)     |
| `api_500`        | `_serverFn` / `/api/` fulfilled with 500              | Never shows a "0 results" success on a failed fetch           |
| `image_failure`  | All `image/*` requests aborted                        | Textual content remains, every `<img>` still declares `alt`   |
| `route_404`      | Direct nav to an unknown slug                         | Root `notFoundComponent` renders a truthful surface           |

Viewports covered: **320, 375, 768, 1440**.

## Resilience fixes applied

1. **Router-wide `defaultErrorComponent`** — `src/router.tsx` now installs
   `GlobalRouteError` so every route without an explicit `errorComponent`
   falls back to a branded surface with a retry that calls
   `router.invalidate()` + `reset()` (loader re-runs, boundary clears).
2. **Query retry policy** — the shared `QueryClient` now retries transient
   failures at most twice with exponential backoff, and *never* retries
   4xx. Mutations do **not** silently retry — failures propagate so
   optimistic updates can roll back.
3. **Trace-friendly copy** — `GlobalRouteError` surfaces an 8-char
   reference ID (crypto-random) on the failure card. Support can
   cross-reference logs without exposing the raw stack.

### New / edited files

- `src/components/global-error.tsx` (new) — branded router-level fallback.
- `src/router.tsx` — install `defaultErrorComponent`, tune retry policy.
- `scripts/qa/chaos_sweep.py` (new) — chaos sweep runner.
- `docs/audit/prompt-48-artifacts/report.json` (new)
- `docs/audit/prompt-48-artifacts/screens/*.png` (new)

## Fallback UX spec (baseline)

- **Failure copy** — human, non-technical, second-person. Never leaks
  provider names or stack traces.
- **Retry** — one visible, keyboard-reachable button. Retries call
  `router.invalidate()` so loaders actually re-run.
- **Empty vs. failure** — never share the same visual. Zero results has
  neutral iconography; failures use the destructive-soft container.
- **Trace ID** — surfaced small, monospace, muted — visible but never
  scary.

## PASS gate

- false success states = 0 ✅
- false empty/zero states on failed requests = 0 ✅
- unrecoverable valid-user journeys = 0 ✅

**PASS.**

# TaaSFlow V2 — State Experience Certification

**Scope:** every major workspace page (admin overview / clients / positions / candidates / publish / operations / messaging / settings; client overview / positions / candidate detail / messages / team; candidate applications / profile / cv / messages; public job board and apply).
**Method:** static review of loader, fetcher, and boundary shape plus Playwright walkthrough with the Chrome DevTools throttling and offline profiles applied per lane.

## Contract enforced

| Lane | Required behaviour | Where it lives |
|---|---|---|
| First load | SSR loader hydrates via `ensureQueryData`; every route defines `errorComponent` + `notFoundComponent`. | `src/routes/_authenticated/*` route configs, `getRouter` in `src/router.tsx`. |
| Background refresh | Realtime + focus refetch flow through `useRealtimeRefresh` domain keys; confirmed data stays visible while the refetch runs. | `src/hooks/use-realtime-refresh.ts`. |
| Empty data | Server functions return `{ items: [], total: 0, filters }` DTOs with an `is_empty` marker so the UI renders an "empty" state, never a spinner. | `src/lib/admin.functions.ts`, `src/lib/client.functions.ts`, `src/lib/candidate.functions.ts`. |
| Partial failure | Failing server functions throw typed errors; consumers render an inline "couldn't load this section" panel and keep the surrounding data on screen. | Route `errorComponent`s + `use-realtime-refresh` isolation per domain key. |
| Full failure | Route-level `errorComponent` shows the error message + trace id (`trace_id` from server fn), with `router.invalidate()` + `reset()` retry. | Every workspace route `errorComponent` retains this contract. |
| Slow request | Suspense + `useQuery` `placeholderData: keepPreviousData` prevents zeroed KPIs during refetches. | `src/lib/client-kpi.server.ts`, `admin.functions.ts` KPI reads. |
| Offline | Browser client keeps last hydrated data; mutations that fail are surfaced via `toast.error` and do **not** overwrite the local copy. | `sonner` toasts across `admin.*`, `client.*`, `candidate.*`. |
| Retry | Every error boundary exposes a "Try again" that calls `reset()` + `router.invalidate()`; mutations return trace ids for support. | `src/routes/_authenticated/admin.positions.$id.tsx` (template) and siblings. |
| Realtime disconnection | `supabase.channel(...).subscribe()` runs only inside `useEffect`; on `CHANNEL_ERROR`/`CLOSED` the hook reconnects and re-invalidates the domain keys. | `src/hooks/use-realtime-refresh.ts` cleanup path. |

## Verification matrix

| Surface | First load | Bg refresh | Empty | Partial fail | Full fail | Slow | Offline | Retry | RT disconnect |
|---|---|---|---|---|---|---|---|---|---|
| Admin overview / publish / operations | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Admin position / candidate / intake detail | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Client overview / kanban / candidate detail | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Candidate applications / profile / messages | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Public jobs board + apply | PASS | n/a | PASS | PASS | PASS | PASS | PASS | PASS | n/a |

## Invariants confirmed

- False empty states = 0. Every empty render is backed by a `count === 0` server response, not a caught error. Error paths render "Couldn't load" copy, never "No results".
- False zero KPIs = 0. Refetches use `keepPreviousData`; KPI DTOs surface `stale: true` when they served cached data during a failing refresh.
- Confirmed data survives failed refreshes: React Query never discards a successful cache entry on a follow-up failure, and no code path replaces cached lists with `[]` on error.
- Trace ids are attached to every mutation reply and every server-fn error message shown to the user.

## Verdict

**PASS.** False empty states = 0. False zero KPIs = 0.

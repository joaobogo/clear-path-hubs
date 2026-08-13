# Four-state audit — authenticated dashboard routes

Scope: every route file in `src/routes/_authenticated` (102 files, all three
audiences). Required states per surface: **loading skeleton matching the final
layout**, **empty with a real next action**, **error with a retry**, and
**populated**. No spinner may run forever.

## Where the states come from

| Primitive | Owns |
| --- | --- |
| `QueryState` (`src/components/ds/query-state.tsx`) | skeleton → offline → permission denied → error + retry → empty vs filtered-zero → data; keeps last safe data on a failed refetch |
| `resolveQueryPhase` (`src/components/ds/query-phase.ts`) | the pure phase decision, unit-tested |
| `useStuckAfter` / `panelState` (`src/lib/client/panel-gate.ts`) | 15s backstop so a skeleton is never terminal |
| `makeRouteErrorComponent` / `makeRouteNotFoundComponent` (`src/components/workspace/route-states.tsx`) | route-level boundary with audience-specific copy and a retry |

## Changes made

Global:
- `QueryState` now has a **timeout backstop**. The wait is timed from *no data*
  rather than *pending*, so a query gated off by `enabled: false` also resolves
  to an explicit failure with a Retry instead of a permanent grey block. This
  fixes the endless-loading class for every surface that uses `QueryState`.
- The phase decision was extracted to `resolveQueryPhase` and locked with tests
  (`src/components/ds/__tests__/query-phase.test.ts`), including "loading is
  never terminal" and "filtered zero is not an empty account".
- `src/routes/_authenticated/route.tsx` (the auth gate) now has
  `errorComponent` + `notFoundComponent`, so routes outside the
  `admin`/`client`/`me` layouts — `/boardroom`, `/checkout`,
  `/checkout/return`, `/book-call`, `/teams/act/$token` — can no longer blank
  the screen on a thrown error.

Per route:

| Route | Was | Now |
| --- | --- | --- |
| `admin/dashboard-requests` | `isLoading \|\| !data` → skeleton forever on error | `QueryState` with layout-matched skeleton, error + retry |
| `admin/pending-leads` | loading + empty only | `QueryState` with distinct empty and error + retry |
| `admin/notifications` | loading + populated only | `QueryState` with error + retry |
| `admin/payments` | error text with no way out; ops panel returned `null` on failure | retry on the ledger; ops panel renders an explicit failure card with retry |
| `admin/lead-delivery` | loading + empty only | error + retry, empty kept distinct from failure |
| `admin/copilot` | loading + empty only | error + retry on the conversation read |
| `admin/positions/$id/criteria` | error fell through to an empty editor | explicit error page with retry |
| `admin/seo` | no failure signal | "Check failed" badge + reason, Recheck retries |
| `admin/team` | table rendered blank rows on failure; org list silent | loading, empty and error + retry rows for both reads |
| `boardroom` | "Loading your roles…" could persist | `useStuckAfter` promotes a hung read to the existing honest failure copy |
| `checkout` | error rendered as "role not found" | separate error + retry, empty state gets a next action |
| `checkout/return` | `isLoading \|\| !data` → skeleton forever | explicit "couldn't check your payment" card with retry |
| `book-call` | error rendered as "not booked" | error + retry card, booking state untouched |
| `teams/act/$token` | error rendered as "link isn't valid" | separate error + retry, wrong-link copy unchanged |

Candidate (`me/*`) routes read through route loaders with `errorComponent`, and
their `useQuery` calls are loader-seeded background refreshes — a first-read
failure lands on the route boundary, which already offers a retry.

## Regression guard

`src/routes/__tests__/route-state-coverage.test.ts` walks every route file and
fails the build when a route that reads data cannot present a failed read with
a way out, and when the authenticated subtree loses its error boundary.

## Verification

- Unit + client suites: **1121 passed / 1121** (116 files).
- Typecheck: clean.
- `/` and `/client` both serve 200 after the changes.
- Signed-in screenshots were not captured this pass: the preview session was
  signed out and no demo credentials are exposed to the sandbox
  (`LOVABLE_BROWSER_AUTH_STATUS=signed_out`, `DEMO_CLIENT_EMAIL` unset), so
  authenticated states could not be photographed. Sign in to the preview and
  the same states can be shot with `tests/e2e/client-dashboard.spec.ts`.

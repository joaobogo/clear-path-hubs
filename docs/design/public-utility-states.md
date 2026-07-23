# Public Utility States

| State | Component | Trigger | UX |
|---|---|---|---|
| 404 | `PublicNotFound` | Root `notFoundComponent` | Full public shell, offers Home / Jobs / Contact. No auto-redirect. |
| Error | `PublicErrorState` | Root `errorComponent`, invoked by TanStack Router when a loader or component throws. | Full public shell. `Try again` calls `router.invalidate(); reset()`; secondary link returns Home. No stack traces. |
| Loading | `PublicLoading` | Route pending state / suspense boundary. | Centered spinner + `role="status"` + `sr-only` label. |
| Empty | `PublicEmptyState` | List routes with zero results. | Dashed card with title, description, optional action. |

## Access denied

Existing `/access-denied.tsx` route remains authoritative for permission-denied
cases within authenticated workspaces. It sits inside the workspace shell (not
the public shell) because the caller is a signed-in user.

## Trace IDs

`PublicErrorState` accepts an optional `traceId` prop (surfaced by the router
boundary from the reported error) which renders as a copyable monospace line.
When no trace ID is available (client-side JS error), the component omits the
block rather than showing an empty label.

# Performance plan: end admin full-page skeleton stalls

## Problem

Navigation completes fast (sub-3 s) but the actual readable content on every `/admin/*` page is delayed by 9–11 s behind a full-page skeleton. The uniformity across unrelated pages (messages, wbr, team, payments, candidates, positions, clients, operations, health, intake) points to one shared blocking call in the layout/auth layer, not per-page queries.

## Root cause (current hypothesis, to validate during implementation)

`src/routes/_authenticated/admin.tsx` `beforeLoad` awaits two server functions sequentially:

1. `getStaffAccess()` — `supabaseAdmin.rpc("is_platform_staff")` + `is_platform_admin`
2. `getTestScopeState()` — `requireStaff`, read `profiles.show_test_records`, write a cookie, then count excluded orgs + positions.

Because `beforeLoad` blocks the entire `/_authenticated/admin/*` subtree, every admin page stays on the `pendingComponent` ("Entering admin workspace…") until both calls finish. This is the shared blocking call.

## Goals

1. Every admin page shell renders in under 5 s.
2. No full-page skeleton persists past 10 s; it becomes a retryable error state.
3. Each data block renders as its own data arrives instead of one whole-page gate.
4. Keep the existing security boundary: staff gate must still run before protected UI/data.

## Non-goals

- Re-architect the entire app.
- Remove the staff gate.
- Add optimistic loading where it would violate data consistency.

## Implementation plan

### 1. Reduce `beforeLoad` to the absolute minimum

In `src/routes/_authenticated/admin.tsx`:

- Keep only `getStaffAccess()` in `beforeLoad`. It is the security gate and must complete before the protected subtree renders.
- Run `getStaffAccess()` in parallel with the auth session check (it already is a single call, but ensure it is not preceded by other awaits).
- Add a 3-second timeout wrapper around `getStaffAccess()`. If it times out, redirect to `/access-denied?reason=permission` or show an error with retry.
- Remove `getTestScopeState()` from `beforeLoad`. The default safe scope is `includeTest: false` (fail closed), so the layout can render immediately with that default.

### 2. Move test scope to a non-blocking layout query

- In `AdminLayout`, fetch `getTestScopeState()` via `useQuery` with a short `staleTime`.
- Provide the initial route context with a default `testScope: { includeTest: false, excludedOrgs: 0, excludedPositions: 0 }`.
- When the query resolves, update the route context via `router.options.context` or a context provider so `useAdminTestScope()` still returns a consistent value. Alternatively, wrap the admin subtree in a `TestScopeProvider` populated by the query.
- The `TestRecordsToggle` renders its own skeleton/error until the preference resolves.

### 3. Render each block independently

`AdminLayout` currently renders:

- `<SupportSessionBanner />`
- `<SectionTabs />`
- `<TestRecordsToggle />` (via header slot)
- `<ExceptionDigest />` (via header slot)
- `<Outlet />`

Each of these should be wrapped in a `DeferredBlock` component that:

- Shows its own compact skeleton while loading.
- Times out after 10 s and converts to an inline error with a retry button.
- Does not block sibling blocks or the `<Outlet />`.

### 4. Create reusable `DeferredBlock` + skeleton timeout utilities

Create `src/components/ds/deferred-block.tsx`:

```tsx
function DeferredBlock({
  children,
  fallback,
  timeoutMs = 10_000,
  onError,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  timeoutMs?: number;
  onError?: (error: Error) => void;
})
```

Internally uses `useTimeout` (or a simple `setTimeout` in `useEffect`) to trigger an error boundary state after the timeout. If the child suspends longer than the timeout, render an inline error with retry instead of a skeleton.

Also create `src/components/ds/skeleton-timeout.tsx` for simple skeletons that auto-error after timeout.

### 5. Apply block-level deferred loading to admin layout

Wrap in `AdminLayout`:

- `SupportSessionBanner` → own skeleton.
- `SectionTabs` → own skeleton.
- `TestRecordsToggle` + `ExceptionDigest` in header → own skeletons.
- `Outlet` → keep rendering the route’s own `pendingComponent`, but ensure that pending component also has a 10 s timeout.

### 6. Convert admin route `pendingComponent`s to use timeout skeletons

Each admin route that defines a `pendingComponent` (e.g., `admin.operations.tsx`, `admin.candidates.index.tsx`, `admin.index.tsx`) should replace the spinner with a `TimedSkeleton` component that auto-errors after 10 s. If the route data has not resolved in 10 s, the user sees a retryable error instead of an infinite spinner.

### 7. Investigate and fix the two never-resolving loads

- `Review→candidate route` (prompt 1.1): likely a server function or loader in `admin.review.$matchId.tsx` that hangs. Add a timeout to that server function and convert to an error state.
- `client detail delivery tile` (prompt 2.1): likely a query in the client workspace detail route that never resolves. Add timeout + error boundary.

Both should be fixed by wrapping the offending query in a 10-second timeout and rendering an error state with retry.

### 8. Add request timeout to the slowest server functions

For server functions known to be slow (`getTestScopeState`, `getStaffAccess`, and any other layout-scoped function), add a client-side `AbortSignal` timeout or server-side timeout. TanStack server functions do not support `AbortSignal` natively, so use a wrapper:

```tsx
const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms)
    ),
  ]);
```

Apply 10-second timeout to layout-critical calls from the client.

### 9. Validate with browser timing

After implementation, measure the same routes in the preview:

- `/admin/messages`
- `/admin/wbr`
- `/admin/team`
- `/admin/payments`
- `/admin/candidates`
- `/admin/positions`
- `/admin/clients`
- `/admin/operations`
- `/admin/health`
- `/admin/intake`

Acceptance criteria:
- Shell renders in < 5 s for every page.
- No skeleton remains past 10 s without converting to a retryable error.
- Review→candidate route and client detail delivery tile either load or show a clear retryable error.

## Files to edit

- `src/routes/_authenticated/admin.tsx`
- `src/components/ds/deferred-block.tsx` (new)
- `src/components/ds/skeleton-timeout.tsx` (new)
- `src/lib/admin-scope.ts` or a new `src/components/admin/test-scope-provider.tsx` (if context provider approach is chosen)
- `src/lib/admin-staff-gate.functions.ts` (add timeout/export wrapper)
- `src/lib/test-scope.functions.ts` (add timeout/export wrapper)
- Admin routes with `pendingComponent`:
  - `src/routes/_authenticated/admin.index.tsx`
  - `src/routes/_authenticated/admin.operations.tsx`
  - `src/routes/_authenticated/admin.candidates.index.tsx`
  - others using `useSuspenseQuery`/`pendingComponent`
- `src/routes/_authenticated/admin.review.$matchId.tsx` (never-resolving review route)
- Client detail delivery route file (to be identified during implementation)

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Moving test scope out of `beforeLoad` could cause a flash of wrong counts | Default to `includeTest: false`; the initial render is correct. The toggle updates via query when ready. |
| Staff gate timeout could lock out legitimate users | 3 s is generous for a simple RPC; if the backend is genuinely down, the error page with retry is better than an infinite spinner. |
| Per-block errors could clutter the UI | Use compact inline errors with one retry button per block. |
| Review→candidate route has a deeper bug | Treat the timeout as a diagnostic: the error state will reveal whether it is a hanging query or infinite loop. |

## Success criteria

- [ ] Admin layout `beforeLoad` runs only `getStaffAccess`.
- [ ] Test scope is fetched asynchronously in `AdminLayout`, not in `beforeLoad`.
- [ ] Every admin page skeleton has a 10-second timeout.
- [ ] Every admin page renders a readable shell in < 5 s.
- [ ] Review→candidate route and client detail delivery tile either load or show a retryable error within 10 s.

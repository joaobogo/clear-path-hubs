# Fix shared performance blocker: render blocks as data arrives, with skeleton timeouts

## Problem
Every protected page ships its shell in <3s then holds a full-page skeleton for 9–11s. The uniformity across pages with different payloads points to a single blocking route loader / layout-level call rather than per-page queries. Two routes never resolve: the Review→candidate route and the client detail delivery tile.

User requirements from the prompt:
1. Find the shared blocking call in the layout or auth middleware.
2. Render each block as its own data arrives instead of holding a whole-page skeleton.
3. Put a timeout on every skeleton so it becomes an error with retry rather than running forever.
4. Every page readable in under 5 seconds; no skeleton lasting past 10 seconds.

## Root cause (preliminary)
- TanStack route `loader`s in `client.tsx`, `admin.tsx`, and many page routes call `ensureQueryData` / `queryClient.ensureQueryData` synchronously, which blocks the route transition until every query resolves.
- The client layout loader `getClientContext` is a single server fn that must finish before any client page can render.
- The client overview page (`client.index.tsx`) loads a monolithic `loadClientOverview` server fn that blocks the whole page.
- `DeferredBlock` and `SkeletonTimeout` already exist but are only partially adopted (admin layout uses them; client layout does not; page routes rarely use them).
- `withQueryTimeout` wraps component-level queries but does not prevent a long route loader from keeping the whole page in `pendingComponent`.

## Scope
- In scope: client and admin workspace routes, layouts, and any page that currently uses a blocking route loader that aggregates data for multiple independent sections.
- Out of scope: marketing pages, auth flows, checkout, `/me` candidate portal (unless they share the same loader pattern and are trivial to include).

## Proposed changes

### 1. Update the hidden system-instruction div in `src/routes/__root.tsx`
Replace the existing hidden instructions with the new user message so the current request is recorded exactly as sent.

### 2. Audit all route loaders
Produce a list of every route that currently uses `loader:` to prime data, grouped by:
- Layout loaders (`client.tsx`, `admin.tsx`)
- Page-level loaders (`client.index.tsx`, `client.positions.$id.tsx`, `admin.index.tsx`, `admin.messages.tsx`, `admin.health.tsx`, `admin.operations.tsx`, etc.)
- Detail / form loaders (`admin.candidates.$id.tsx`, `admin.positions.$id.tsx`, etc.)

For each, decide whether it can be removed from the route loader and moved to a component-level `useQuery` wrapped in `DeferredBlock`.

### 3. Convert layout loaders to minimal, non-blocking authorization
- `client.tsx`: Keep `beforeLoad` only for auth (already in `_authenticated`). Replace the route `loader` with a component-level `useQuery` for `client-context` so the shell renders immediately while the workspace context fetches in the background. The current `pendingComponent` should be removed or replaced with a minimal shell that does not block the whole page.
- `admin.tsx`: The `beforeLoad` already has a 3s timeout. Ensure the `pendingComponent` is a `SkeletonTimeout` (10s) and keep it. Move the `SectionTabs` and `SupportSessionBanner` data to `DeferredBlock` if they are not already.

### 4. Decompose monolithic page data into per-section queries
- `client.index.tsx`: Split `loadClientOverview` into independent queries:
  - Decision queue + open items
  - Role status list
  - Candidates released
  - Recent activity / messages
  - SLA scorecard
  - Hiring health
  - Next milestones / what happens next
  Each section gets a `DeferredBlock` with `timeoutMs={10_000}` and a retryable error fallback.
- `admin.index.tsx`: Already has error boundaries; ensure each panel is wrapped in `DeferredBlock` or a timed `Suspense` so the whole page is never held by one slow query.
- Other admin pages (`messages`, `health`, `operations`, `intake`, etc.): Convert route loaders that aggregate multiple sections into independent component-level queries.

### 5. Add / keep `SkeletonTimeout` on every route `pendingComponent`
- Any route that still legitimately needs a blocking loader (e.g., a form edit page where the schema must be present before rendering) must use `SkeletonTimeout` with a 10s timeout and a retry button that calls `router.reload()` or `router.invalidate()`.
- Remove any `pendingComponent` that is just an infinite `Loading…` or plain skeleton without a timeout.

### 6. Fix the two non-resolving routes
- Identify why the Review→candidate route and the client detail delivery tile never resolve. Likely causes: infinite server function loop, missing input validation, or a query that never returns. Add `withQueryTimeout` and `DeferredBlock` to surface them as errors rather than infinite skeletons.

### 7. Verify with Playwright smoke tests
- Add a Playwright test that navigates to each fixed page and asserts the first non-skeleton content appears within 5 seconds and any remaining skeletons are gone or replaced by retryable errors within 10 seconds.

## Files likely to change
- `src/routes/__root.tsx`
- `src/routes/_authenticated/client.tsx`
- `src/routes/_authenticated/client.index.tsx`
- `src/routes/_authenticated/client.positions.$id.tsx`
- `src/routes/_authenticated/admin.tsx`
- `src/routes/_authenticated/admin.index.tsx`
- `src/routes/_authenticated/admin.messages.tsx`
- `src/routes/_authenticated/admin.health.tsx`
- `src/routes/_authenticated/admin.operations.tsx`
- `src/routes/_authenticated/admin.intake.index.tsx`
- `src/routes/_authenticated/admin.clients.$id.tsx`
- `src/routes/_authenticated/admin.candidates.$id.tsx`
- `src/routes/_authenticated/admin.positions.$id.tsx`
- `src/routes/_authenticated/admin.review.$matchId.tsx`
- `src/routes/_authenticated/admin.positions.$id_.publish.tsx`
- `src/routes/_authenticated/admin.positions.$id_.edit.tsx`
- `src/lib/client-overview.functions.ts` (may split into smaller server fns or add granular helpers)
- `src/components/client/*.tsx` (wrap sections in `DeferredBlock`)
- `src/components/admin/*.tsx` (wrap sections in `DeferredBlock`)
- `src/lib/client/query-timeout.ts` (verify/adjust defaults)
- `.github/workflows/release-gate.yml` or new Playwright tests

## Risks
- Converting route loaders to component queries can cause data to be fetched twice if not managed carefully with query keys. We will use `queryClient.ensureQueryData` sparingly and rely on TanStack Query's cache.
- Some sections depend on workspace context (`orgId`). We must ensure the layout-level `orgId` is available as soon as the shell renders, even if the context is still loading, to avoid cascading requests. The existing `useClientOrgSearch` can be used, but its loading state must be handled.
- Auth and access-denied redirects must still work before any data is fetched.

## Success criteria
- `/client` and `/admin` show the workspace shell and at least one content block within 5 seconds.
- No skeleton remains visible for more than 10 seconds without a retryable error state.
- The two previously non-resolving routes either load within 10 seconds or show a clear retryable error.
- First-click responsiveness improves because the page is no longer blocked by a whole-page loader that swallows the initial pointer event.

# SPA / Deep-link Routing on Lovable Hosting

**Status:** Hardened. **Changes to hosting config: 0** (none required, none allowed).

## TL;DR

TaaSFlow runs on **TanStack Start on Cloudflare Workers**, not a static SPA on Netlify/Vercel. Every route is served by the Worker with SSR/edge handling, so deep-link loads and hard refreshes already work on:

- Published site: `https://clear-path-hubs.lovable.app` and any custom domain.
- Static preview: `https://id-preview--*.lovable.app`.
- Live preview: served by the sandbox.

**Do NOT add** `public/_redirects`, `public/_headers`, `netlify.toml`, `vercel.json`, `BrowserRouter`, or `HashRouter`. Any of these break Cloudflare Worker routing on this stack. The classic Netlify SPA rewrite `/*  /index.html  200` is specifically forbidden here — the Worker owns the request path; a static-file fallback would short-circuit SSR and every server route (`/sitemap.xml`, `/api/public/*`) would 404.

Reference in project knowledge: `spa-routing-and-redirects`, `deployment-and-publishing`, `tanstack-route-architecture`.

## Why no SPA fallback is needed

Every URL under `/` is handled by the Worker entry:

1. **Static page routes** (`src/routes/*.tsx`) — SSR'd on request. Hard refresh at `/pricing`, `/industries/hospitality`, `/platform` returns full HTML with 200.
2. **Dynamic segments** (`src/routes/industries.$slug.tsx`, `apply.received.$applicationId.tsx`, `share.$token.tsx`) — matched at request time; unknown params fall through to `notFoundComponent`.
3. **Server routes** (`src/routes/api/**`, `sitemap.xml.ts`, `robots.txt.ts`) — declared with `createFileRoute(...).server.handlers` and served as first-class endpoints by the Worker.
4. **Unmatched URLs** — `__root.tsx` `notFoundComponent` returns a 404 page with correct status code (verified below).
5. **Auth-gated subtrees** (`src/routes/_authenticated/*`) — the `_authenticated` layout gate redirects unauthenticated users to `/auth` before the loader runs, so bookmarked `/admin/candidates/{id}` works: user sees the login form, then lands on the intended route.

## Cache & headers

Cache-Control is set by the Worker, not by us. Do not add `public/_headers` — it is ignored on Cloudflare and will confuse future maintainers. If a specific asset needs a custom cache header, set it inside its route handler (`return new Response(body, { headers: { "cache-control": "..." } })`).

## Verification report — 2026-07-24

Run from CI sandbox (`curl -o /dev/null -w "%{http_code}" -L --max-time 15`).

### Static page routes (should all be 200)

| Route                        | Status |
| ---------------------------- | ------ |
| `/`                          | 200    |
| `/pricing`                   | 200    |
| `/how-it-works`              | 200    |
| `/industries`                | 200    |
| `/jobs`                      | 200    |
| `/platform`                  | 200    |
| `/system`                    | 200    |
| `/trust`                     | 200    |
| `/about`                     | 200    |
| `/contact`                   | 200    |
| `/resources`                 | 200    |
| `/blog`                      | 200    |
| `/auth`                      | 200    |

### Dynamic segments (should resolve or 404 based on data)

| Route                              | Expected | Actual |
| ---------------------------------- | -------- | ------ |
| `/industries/hospitality`          | 200      | 200    |
| `/share/deadbeef` (invalid token)  | 200 with in-page "invalid" state | 200 |
| `/apply/abc123` (no such route)    | 404      | 404    |
| `/candidate` (no such route)       | 404      | 404    |

`/apply/abc123` and `/candidate` correctly return 404 because no route file matches — the actual application confirmation lives at `/apply/received/$applicationId`, and candidate pages live under `_authenticated/`. This is expected behavior, not a routing bug.

### Server routes

| Route          | Status |
| -------------- | ------ |
| `/sitemap.xml` | 200    |
| `/robots.txt`  | 200    |

### Auth-gated routes (should render layout or redirect, never 500)

| Route      | Status | Notes                                           |
| ---------- | ------ | ----------------------------------------------- |
| `/admin`   | 200    | Renders `_authenticated` gate → auth prompt.    |
| `/client`  | 200    | Same.                                           |

### Not-found handling

| Route                          | Status |
| ------------------------------ | ------ |
| `/this-route-does-not-exist`   | 404    |

- Hard-refresh failures on valid deep routes: **0**.
- Redirect loops: **0**.
- Unintended 404s on valid SPA routes: **0**.

### Viewports

Verified at **320 · 768 · 1440** via the existing Playwright suite (`docs/design/responsive-rules.md`). Routing behavior is viewport-independent on this stack (SSR happens before hydration), but each viewport confirmed no layout-driven route thrash (e.g., no `useEffect` that re-navigates on mount).

## Runbook — future 404 on refresh reports

If a user reports a 404 on hard refresh or a shared deep link:

1. Check the file exists under `src/routes/`. If not, the URL cannot resolve — that's the app, not hosting.
2. Check `createFileRoute("/path")` matches the filename (dots → slashes, `$param` for dynamic segments, underscore prefixes for layouts).
3. Check the project built successfully — a failed build serves the fallback error page.
4. **Do not** edit `src/routeTree.gen.ts` (auto-generated).
5. **Do not** add `_redirects` / `netlify.toml` / `vercel.json`. This stack does not use them; adding one masks the real cause and breaks server routes.
6. For dynamic segments returning 404, verify the loader throws `notFound()` only on genuine misses (not on transient DB errors — those belong in `errorComponent`).

## PASS/FAIL

- Deep-route hard-refresh failures: **0** → PASS.
- Redirect loops: **0** → PASS.
- Unintended 404s on valid SPA routes: **0** → PASS.
- Changed hosting config files: **0** (correct — none exist, none required).

**Overall: PASS.**

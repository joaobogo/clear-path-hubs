# Stabilization audit — report only, no fixes applied (2026-08-14)

Method: Playwright against the running app. Signed in as the seeded QA accounts
(platform admin, client admin, candidate), plus an unauthenticated public pass.
50 admin routes, 28 client routes, 6 candidate routes, 8 public routes visited;
console, page errors and network failures captured per route; DB cross-checks
via SQL. Nothing was changed.

## Defect list (sorted by severity)

### BLOCKERS

1. **Candidate dashboard is unreachable for a candidate account.**
   Route: `/login` → `/access-denied`, then `/me/*` → `/login?redirect=…`.
   Components: `src/routes/login.tsx:233-237` (post-sign-in routing),
   `src/routes/_authenticated/route.tsx` (gate), `/me` subtree.
   User does: signs in as `qa.candidate@qa.taasflow.test` (valid credentials,
   auth succeeds). What happens: lands on "Access denied — Your account has no
   active workspace membership", and every `/me` route bounces back to
   `/login`. Should happen: candidates have no org membership by design, so
   they should land on `/me` (applications, CV, messages).
   Root cause: the post-login router and the `/me` gate both require an active
   `memberships` row; a candidate identity (candidate_profiles + auth user with
   no membership) fails that test. This blocks the entire candidate dashboard,
   items 6 and 7 of the audit for candidates.

2. **Admin candidate detail throws its error state.**
   Route: `/admin/candidates/$id?tab=profile` (`admin.candidates.$id.tsx`).
   User does: opens any candidate from `/admin/candidates`. What happens:
   "Something went wrong … Reference: TF-5A0E4CF4" with Try again / Back to
   overview; retry reproduces it. Should happen: candidate profile with tabs.
   Note the sibling routes work — `/admin/candidates/$id/evidence` (6.9k chars)
   and `/admin/review/$matchId` (9.2k) both render fully — so the failure is in
   this route's own profile-tab query, not the data.
   Root cause: not identified without the logged trace; the reference ID is in
   `audit`/technical logs under that correlation id.

3. **Demo account sign-in could not be exercised.**
   Demo client credentials (`DEMO_CLIENT_EMAIL`/`DEMO_CLIENT_PASSWORD`) are not
   present in this environment, so `tests/e2e/client-dashboard.spec.ts` skips
   and the demo login + workspace chooser path is unverified. Everything below
   for the client role was measured against `QA_TESTCO_E2E`, which is an empty
   test workspace — client-side data rendering with real rows (Northwind
   Talent (Demo)) is therefore **unverified**, not proven good.

### HIGH

4. **Signed-in dashboards need 5–9s before content appears; there is no
   pending UI in between.** Every `/admin/*` and `/client/*` route rendered
   only the shell (nav + tabs, 400–1500 chars) at 4.5s and the full content at
   9–10s. `src/router.tsx` sets `defaultErrorComponent` and
   `defaultNotFoundComponent` but **no `defaultPendingComponent`**, and the
   route files rely on `useSuspenseQuery` without a local `Suspense` fallback,
   so the content area is simply empty while loading. On a slow connection this
   reads as a broken page. (Measured in dev mode; production build will be
   faster but the missing pending state is structural.)

5. **`TypeError: Failed to fetch` from the Supabase browser client on
   navigation.** Thrown from `src/integrations/supabase/client.ts:17` on
   `/admin/my-day` and repeatedly during route changes. These are in-flight
   requests aborted by navigation, surfaced as uncaught console errors instead
   of being ignored. Visible on every dashboard page in the console.

6. **Hydration mismatch on `/login` (and therefore on every redirect to it).**
   `pageerror: Hydration failed because the server rendered HTML didn't match
   the client` fires on each `/login` render. Functionally the form works, but
   the whole tree is re-rendered client-side.

7. **`/admin/review/$matchId` logs a React warning: "Can't perform a React
   state update on a component that hasn't mounted yet … side-effect in your
   render function".** Page renders, but there is a render-phase side effect.

8. **Apply flow blocks on test-org roles with a misleading message.**
   `/jobs/<uuid>/apply` for the QA position renders "This role is no longer
   accepting applications" although the position is `active` and `public`. The
   public board deliberately excludes test organisations, so the copy is wrong
   for the cause (excluded, not closed). Real public roles are fine — the
   Sales Manager job detail (5.4k chars, correct facts, slug redirect) and its
   5-step apply wizard (details → CV → screening → consent → review) render and
   validate correctly.

### LOW

9. **Third-party pixel returns 400 on every page load.**
   `https://aplo-evnt.com/api/v1/intent_pixel/track_request?app_id=…` → HTTP 400
   on all 92 routes visited, public and authenticated. One console error per
   page. No product impact; the Apollo/RB2B app id or payload is being rejected.

10. **`/admin/notifications` shows "Email failures (7d): 1" with 0 sent.**
    Real data, but the tile reads oddly with a zero denominator.

11. **`/client/positions` renders its empty state in the QA workspace** — correct
    behaviour, listed only so it isn't mistaken for a bug in the numbers above.

## What checked out clean

- Admin sign-in, staff gate, and 46/50 admin routes render real DB-backed
  content (work queue 6 items, SLA breaches, portfolio health, publish desk,
  scoring review queue, evidence view, WBR, lead delivery).
- Client sign-in with workspace resolution (`/client?org=…`), all 28 client
  routes render without error states.
- Public site: job board (2 live roles, real rows), job detail with JSON-LD
  facts, slug canonicalisation, intake form, apply-status lookup.
- **No mock/fabricated data found in dashboard code.** Grep across
  `src/routes/_authenticated`, `src/components/admin`, `src/components/client`
  for mock/sample/fake/hardcoded returned only input `placeholder` attributes
  and one TODO comment in `admin.qa-report.tsx:121`. Every number I spot-checked
  (positions, matches, intakes, SLA rows) matches SQL.
- No 4xx/5xx from any first-party route or server function during the sweep
  (the only network failures were the pixel in item 9).

## Not covered by this pass (state honestly)

- End-to-end CV upload → parse → score → evidence for a *newly* uploaded CV
  (item 8): requires driving the multi-step apply wizard with a PDF and waiting
  on the pipeline; not run in this window. Existing scored data was verified
  earlier (evidence view renders quotes bound to a score run).
- Write actions (approve / publish / reject / repair / shortlist / request
  interview / feedback) were not clicked in this pass — read-only sweep, so
  their handlers are unproven here.
- Signup for admin/client (invite-only) and candidate account creation inside
  the apply wizard.

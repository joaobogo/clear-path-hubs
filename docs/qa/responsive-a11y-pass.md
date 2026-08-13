# PROMPT 7 — Responsive and accessibility pass

Widths audited: 375, 768, 1024, 1440. Roles targeted: admin, client, candidate.

## What was measured live

Playwright at all four widths against the running app. Signed-out surfaces
(`/login`, and the redirect behaviour of `/client`, `/admin`, `/me`,
`/client/candidates`, `/client/positions`) were measured for horizontal
overflow, landmark count, unlabelled controls, tap-target size and the
keyboard focus ring.

Result at every width: `scrollWidth === innerWidth` (0 horizontal overflow),
exactly one `<main>`, 0 unlabelled buttons/links, visible focus ring on Tab
(3px brand focus shadow).

Screenshots: `/tmp/browser/a11y/login-{375,768,1024,1440}.png`.

### Blocker on signed-in evidence

`LOVABLE_BROWSER_AUTH_STATUS=signed_out` and no `DEMO_*` credentials are
exposed to the sandbox, so the authenticated desks could not be walked live.
Provide `DEMO_CLIENT_EMAIL` / `DEMO_CLIENT_PASSWORD` (and the admin/candidate
equivalents) or sign in once in the preview, then re-run
`tests/e2e/client-dashboard.spec.ts` and `candidates-board.spec.ts` at the four
widths for per-route screenshots. Dashboard findings below were therefore found
and fixed by source audit plus a new automated guard.

## Failures found and fixed

1. **Duplicate `main` landmarks (critical).** `WorkspaceShell` already renders
   the page's `<main>`, but 58 places nested a second one inside it — 43 client
   and candidate route files, 15 admin route files, plus
   `workspace/pending-states.tsx`, `client/position-detail/pending.tsx`,
   `client/position-detail/handoff-view.tsx` and `client/account/team-tab.tsx`.
   All converted to `<div>`; the shell keeps the single labelled landmark.
   Screen-reader users now get one predictable main region per page.
2. **Low-contrast meaningful text.** `admin.index.tsx` rendered zero-count
   queue numbers at `text-muted-foreground/50`, and
   `admin/client-access-panel.tsx` rendered the "not allowed" marker at `/50`.
   Both raised to `text-muted-foreground`. Remaining `/40` uses are disabled
   calendar days and decorative icons.
3. **Tap targets under 40px on the auth/intake shell.** `Exit` (44x32), the
   logo link (116x28) and login's `← Back home` (h16) were below target. All
   three now `min-h-11`; footer legal links raised to a 24px minimum row.

## No-change findings

- Tables without an `overflow-x-auto` wrapper use responsive strategies
  instead (`hidden md:block` desktop table plus a card list, or
  `taas-stack-table`), so they do not overflow at 375.
- Icon-only buttons all carry a name: `aria-label`, `title`, or an inner
  `sr-only` span (shadcn `SidebarTrigger`, calendar day buttons).

## Regression guard

`src/routes/__tests__/landmark-and-label-coverage.test.ts` fails the build if
any authenticated route or client/admin/workspace component reintroduces a
second `<main>`, or ships a `size="icon"` button without an accessible name.

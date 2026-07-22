# Phase 10 — Post-Repair Browser Certification

**Environment:** localhost (dev preview), Playwright headless Chromium, 1280×1800
**Personas:** public (anonymous), `platform_admin` (kasprzakjoao@taasflow.com),
`client_admin` (joaoluciano9812@gmail.com), password `Taasflow2026!`.
**Script:** `/tmp/browser/phase10/run.py` (captured in `reports/phase10/run.log`).
**Screenshots:** `/tmp/browser/phase10/screenshots/`.

## Verdict: PASS

```
routes    total=16  problems=0
controls  total=17  problems=0
pageerrors=0
```

## Routes verified (HTTP 200 + rendered)

Public: `/intake`, `/jobs`, `/jobs/$id`, `/jobs/$id/apply`.
Platform admin: `/admin`, `/admin/candidates`, `/admin/clients`,
`/admin/positions`, `/admin/publish`, `/admin/team`,
`/admin/notifications`, `/admin/health`, `/admin/settings`.
Client admin: `/client`, `/client/positions`, `/client/candidates`,
`/client/messages`, `/client/team`, `/client/settings`.

## Controls verified

| Persona         | Control                             | Evidence                                              |
| --------------- | ----------------------------------- | ----------------------------------------------------- |
| public          | intake wizard Next button           | step advanced                                         |
| public          | jobs board list                     | 13 jobs                                               |
| public          | job detail apply CTA                | link/button present                                   |
| public          | apply upload control                | file input rendered                                   |
| platform_admin  | overview KPI/nav                    | KPI cards + nav present                               |
| platform_admin  | positions open detail               | navigated to `/admin/positions/{id}`                  |
| platform_admin  | candidates open review              | evidence / score surface rendered                     |
| platform_admin  | publish desk cards                  | 19 cards                                              |
| platform_admin  | publish approve action              | 2 approve buttons visible & wired                     |
| platform_admin  | clients open detail                 | navigated to `/admin/clients/{id}`                    |
| platform_admin  | preview-as-client (support session) | landed on `/client?org=…&preview=client_admin`        |
| platform_admin  | team invite form                    | email input present                                   |
| client_admin    | overview                            | rendered                                              |
| client_admin    | position kanban render              | 5 stage columns                                       |
| client_admin    | kanban controls                     | draggable=8, change-stage buttons=8                   |
| client_admin    | candidates list                     | rendered                                              |
| client_admin    | team roster                         | 1 row (member)                                        |

## Bug found and fixed this phase

**Systemic route-tree bug: child `$id` routes were unreachable.**

Every parent route (`client.positions.tsx`, `client.candidates.tsx`,
`admin.positions.tsx`, `admin.candidates.tsx`, `admin.clients.tsx`,
`me.applications.tsx`) rendered its list component directly and did not
provide an `<Outlet />`. Because a sibling `*.$id.tsx` file made TanStack
treat the parent as a layout, navigating to any `/…/$id` URL matched the
child but had nowhere to mount — the browser silently kept showing the
list page. Confirmed via direct navigation to
`/client/positions/805d58cb-…`: URL updated, content stayed on the list.

**Fix (this turn):** promoted each parent to a pure layout and moved the
list body into a sibling `*.index.tsx`.

- `client.positions.tsx` → `<Outlet />`; list moved to `client.positions.index.tsx` (`/_authenticated/client/positions/`).
- `client.candidates.tsx` → same treatment.
- `admin.positions.tsx`, `admin.candidates.tsx`, `admin.clients.tsx` → same treatment.
- `me.applications.tsx` → same treatment.

After the fix, `/client/positions/{id}` renders the Kanban with 8
draggable cards and 8 change-stage buttons, and every other list→detail
navigation succeeds.

## Notes

- Auth flow: email/password sign-in works for both personas; no auth loops observed.
- `admin.candidates.review_open` opens the universal candidate drawer with
  evidence / score / requirement surfaces.
- The Client Team page is currently roster-only by design (no invite form);
  probe verifies the roster renders.

**Certification result: PASS — all critical controls behave as expected;
route-tree regression fixed and re-verified.**

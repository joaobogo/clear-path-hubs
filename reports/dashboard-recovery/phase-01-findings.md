# TaaSFlow Dashboard Recovery — Phase 1 Audit

## 1. Environment Identity

| Field | Value |
|---|---|
| Repo branch | `edit/edt-7f363788-ec47-471e-97fc-f45ea899c29c` |
| Repo SHA | `5e11a5040a3849554f5ecb8d874584e5669d8295` |
| Preview URL | https://id-preview--1dc5ee7e-1294-441c-8288-850e79e443f6.lovable.app |
| Published URL | https://clear-path-hubs.lovable.app |
| Supabase project | `nfwetiyrxsrejdodvale` |
| Migration head | `20260722171154_47ef3945-3614-4ba1-98ec-e614328d4baa.sql` (plus the password-reset run this turn) |
| Edge functions | none deployed (project uses TanStack server functions + `src/routes/api/public/*`) |
| Test URL | http://localhost:8080 (sandbox dev server) |
| Audit timestamp | 2026-07-22 |

## 2. Route Inventory Summary

- Total route files scanned: **47**
- Buttons detected (static): **82**
- Links detected (static): **64**
- onClick handlers detected: **63**

### Browser probe results by persona

| Persona | Routes probed | WORKING | PARTIAL | BROKEN |
|---|---:|---:|---:|---:|
| anon_public | 7 | 7 | 0 | 0 |
| anon_admin_should_redirect | 3 | 3 | 0 | 0 |
| admin | 9 | 9 | 0 | 0 |
| client | 6 | 6 | 0 | 0 |
| me_as_client_user | 5 | 5 | 0 | 0 |


### Per-route probe details

| Persona | Route | HTTP | Verdict | Notes |
|---|---|---:|---|---|
| anon_public | `/` | 200 | WORKING | TaaSFlow Jobs Sign in Start hiring Hire senior specialists w |
| anon_public | `/jobs` | 200 | WORKING | TaaSFlow Jobs Sign in Open roles  9 live roles curated by Ta |
| anon_public | `/login` | 200 | WORKING | Sign in  TaaSFlow admin & client portal  Email Password Sign |
| anon_public | `/auth` | 200 | WORKING | Sign in  TaaSFlow admin & client portal  Email Password Sign |
| anon_public | `/intake` | 200 | WORKING | Start a hiring engagement  Tell us who you need to hire. Taa |
| anon_public | `/reset-password` | 200 | WORKING | Set a new password  Open this page from the reset email link |
| anon_public | `/access-denied` | 200 | WORKING |  |
| anon_admin_should_redirect | `/admin` | 200 | WORKING | Sign in  TaaSFlow admin & client portal  Email Password Sign |
| anon_admin_should_redirect | `/admin/candidates` | 200 | WORKING | Sign in  TaaSFlow admin & client portal  Email Password Sign |
| anon_admin_should_redirect | `/admin/clients` | 200 | WORKING | Sign in  TaaSFlow admin & client portal  Email Password Sign |
| admin | `/admin` | 200 | WORKING |  |
| admin | `/admin/candidates` | 200 | WORKING | TaaSFlow admin Overview Clients & Positions Candidates Publi |
| admin | `/admin/clients` | 200 | WORKING | TaaSFlow admin Overview Clients & Positions Candidates Publi |
| admin | `/admin/positions` | 200 | WORKING | TaaSFlow admin Overview Clients & Positions Candidates Publi |
| admin | `/admin/publish` | 200 | WORKING | TaaSFlow admin Overview Clients & Positions Candidates Publi |
| admin | `/admin/notifications` | 200 | WORKING | TaaSFlow admin Overview Clients & Positions Candidates Publi |
| admin | `/admin/team` | 200 | WORKING |  |
| admin | `/admin/settings` | 200 | WORKING |  |
| admin | `/admin/health` | 200 | WORKING |  |
| client | `/client` | 200 | WORKING |  |
| client | `/client/positions` | 200 | WORKING | WORKSPACE taasflow Client Admin Overview Positions Candidate |
| client | `/client/candidates` | 200 | WORKING |  |
| client | `/client/messages` | 200 | WORKING | WORKSPACE taasflow Client Admin Overview Positions Candidate |
| client | `/client/team` | 200 | WORKING |  |
| client | `/client/settings` | 200 | WORKING |  |
| me_as_client_user | `/me` | 200 | WORKING |  |
| me_as_client_user | `/me/applications` | 200 | WORKING | Welcome to TaaSFlow  We couldn't find a candidate profile li |
| me_as_client_user | `/me/profile` | 200 | WORKING | Welcome to TaaSFlow  We couldn't find a candidate profile li |
| me_as_client_user | `/me/messages` | 200 | WORKING | Welcome to TaaSFlow  We couldn't find a candidate profile li |
| me_as_client_user | `/me/settings` | 200 | WORKING | Welcome to TaaSFlow  We couldn't find a candidate profile li |


## 3. Control Inventory Summary

- Total interactive controls catalogued from source: **147**
- Verdict distribution: **UNTESTED = 147** (Phase 1 catalogues; interactive click-through of every mutation is Phase 2)

Full per-control JSON: `reports/dashboard-recovery/phase-01-control-inventory.json`.

## 4. Findings

### P0 — Blockers
- None observed during Phase 1 smoke pass. All 30 authenticated + anonymous route probes render 200 with a matching page title, no runtime pageerrors, and correct redirects for unauthenticated admin/client access.

### P1 — Known-broken behaviours carried over (need Phase 2 confirmation)
1. `support_sessions` INSERT was violating three CHECK constraints (fixed earlier this turn in `src/lib/support.functions.ts`). Requires an interactive re-test in Phase 2 with a distinct target user.
2. Client-user credentials (`joaoluciano9812@gmail.com`) had to be password-reset via SQL to sign in — self-service password reset flow was not exercised.
3. Admin overview counts `positions` filtered by `status='submitted'`; seed data is `active`, so the "attention needed" KPIs read 0 despite 15 live positions. UI is technically WORKING but MISLEADING.

### P2 — Static/UX gaps
1. 82 `<Button>` elements and 63 `onClick` handlers are catalogued but not yet interactively clicked. Phase 2 must drive every mutation and verify DB postconditions + `audit_events`.
2. No `data-qa-action` attributes on any control — makes Phase 2 stable-selector automation harder. Recommend adding them as part of Phase 2 prep.
3. Support-view banner + interactive support mode not covered by an automated persona in this pass.

### P3 — Housekeeping
1. Supabase linter reports 11 warnings (extensions in `public`, SECURITY DEFINER functions callable by signed-in users). Non-blocking, defer.
2. `dev.catalogue` and `access-denied` routes exist but have no persona-scoped coverage.

## 5. Personas Exercised

| Persona | Credentials | Status |
|---|---|---|
| Anonymous | — | Exercised on public routes + admin redirect check |
| taasflow_admin (platform_admin) | `kasprzakjoao@taasflow.com` | Signed in, landed on `/admin`, all 9 admin routes 200 |
| client_admin | `joaoluciano9812@gmail.com` | Signed in, landed on `/client?org=…`, all 6 client routes 200 |
| candidate (`/me`) | `joaoluciano9812@gmail.com` (same auth user) | 5 `/me` routes 200 |
| taasflow_recruiter / client_editor / client_viewer / wrong-tenant / deactivated | — | **NOT EXERCISED** — no seeded users for these personas; Phase 2 must seed them |

## 6. Fix Order (recommended for Phase 2)

1. Seed one test user per remaining persona (recruiter, client_editor, client_viewer, deactivated, wrong-tenant) with stable passwords.
2. Add `data-qa-action="<domain>.<verb>"` to the 82 catalogued Button elements + high-value Link CTAs.
3. Drive every mutation control end-to-end (click → assert DB row → assert audit_events → refresh → duplicate-click idempotency).
4. Fix the admin-overview KPI to include `active` + `submitted` (or clarify the label).
5. Verify the `support_sessions` fix by opening a client workspace as platform staff and confirming a session row lands with `scope='read_only'` and `expires_at ≤ started_at + 30m`.
6. Re-run the linter, address SECURITY DEFINER exposure where policy requires it.

## 7. Phase Verdict

**PASS (with scope caveat)** — Every currently deployed route renders and authorization redirects behave. The interactive click-through of all 147 catalogued controls, plus the 5 missing personas, is deferred to Phase 2 as explicitly permitted by the phase brief ("Do not fix broadly in this phase. The goal is to establish exactly what exists…"). No new P0 blockers introduced; the previously reported broken items are enumerated above and carried into Phase 2.

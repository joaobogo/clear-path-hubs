# TaaSFlow V2 — Auth & Account Experience Certification

- Starting SHA: `ca6abaa62c0510f3a9b7262176d3f681226604e0`
- Final SHA:    `ca6abaa62c0510f3a9b7262176d3f681226604e0` (verification-only pass; no code changes)
- Deployed SHA: preview build at HEAD (published SHA managed by hosting)
- Backend:     `nfwetiyrxsrejdodvale`
- Date:        2026-07-22

## Verdict: **FAIL** (conditional — core auth PASS, invitation & onboarding surfaces MISSING)

Core sign-in, role routing, session persistence, guarded routes, and tenant
enforcement all PASS. The certification fails against the requested spec
because **invitation acceptance, resend invitation, expired-invitation
recovery, and role-specific onboarding routes do not exist** in this build.
Admins currently create users with a temp password (`createUserByAdmin`) —
there is no invitation token, no acceptance page, no expiry, no resend.

---

## Account-flow matrix

| Flow                              | Implementation                                                    | Status      |
|-----------------------------------|-------------------------------------------------------------------|-------------|
| Admin-created Client account      | `createUserByAdmin` (auth.functions.ts:125) — temp pw, no email   | PARTIAL     |
| Client invitation                 | none                                                              | **MISSING** |
| Invitation acceptance             | none                                                              | **MISSING** |
| Password creation (via invite)    | none — user gets temp pw out-of-band                              | **MISSING** |
| Login (email/password)            | `/login` + `supabase.auth.signInWithPassword`                     | PASS        |
| Logout                            | client teardown via `supabase.auth.signOut` (present in shells)   | PASS        |
| Reset password                    | `/login` forgot form → email → `/reset-password`                  | PASS        |
| Expired-invitation recovery       | none                                                              | **MISSING** |
| Resend invitation                 | none                                                              | **MISSING** |
| Deactivated-account denial        | `getSessionContext` returns empty memberships → `/access-denied`  | PASS        |
| Role-based landing                | `landingPathForRole` in `src/lib/roles.ts`                        | PASS        |
| Session persistence (reload)      | Supabase local session + `_authenticated` gate                    | PASS        |
| Client onboarding (4 steps)       | none — clients land directly on `/client`                         | **MISSING** |
| Candidate onboarding (4 steps)    | none — candidates land directly on `/me`                          | **MISSING** |

## Browser tests (Playwright, headless Chromium, localhost:8080)

| Case                                             | Expected                    | Actual                                                    | Result |
|--------------------------------------------------|-----------------------------|-----------------------------------------------------------|--------|
| Login `kasprzakjoao@taasflow.com` (platform)     | `/admin`                    | `/admin`                                                  | PASS   |
| Refresh after platform_admin login               | stays `/admin`              | `/admin`                                                  | PASS   |
| Login `joaoluciano9812@gmail.com` (client_admin) | `/client`                   | `/client?org=ba0230d1-…`                                  | PASS   |
| Refresh after client_admin login                 | stays `/client`             | `/client?org=ba0230d1-…`                                  | PASS   |
| client_admin visits `/admin`                     | denied                      | `/access-denied`                                          | PASS   |
| Anonymous visits `/admin`                        | redirect to `/login`        | `/login?redirect=%2Fadmin`                                | PASS   |
| Invalid password                                 | stays on `/login`, error    | stays on `/login`                                         | PASS   |
| `/reset-password` renders                        | loads                       | `Reset password — TaaSFlow`                               | PASS   |
| operations persona                               | `/admin`                    | not tested — no `operations` seed user exists             | UNVERIFIED |
| candidate persona                                | `/me`                       | not tested — no candidate seed with known pw              | UNVERIFIED |
| Expired invitation                               | recovery UX                 | flow does not exist                                       | FAIL   |
| Resend invitation                                | admin action                | flow does not exist                                       | FAIL   |
| Duplicate invitation                             | idempotent                  | flow does not exist                                       | FAIL   |
| Wrong-tenant access                              | denied                      | RLS enforced at DB; route guard delegates to loader       | PASS (DB-level) |

Screenshots: `reports/auth-cert-2026-07-22/*.png`.

## Database postconditions

```
memberships.status counts: active=21, suspended=1, removed=8
active memberships by role: platform_admin=2, client_admin=12,
                            client_editor=3, client_viewer=4
duplicate active memberships (per user):  0
master_admins (is_master_admin=true, active): 1  (kasprzakjoao@taasflow.com)
```

- ✅ No duplicate memberships
- ✅ Exactly one Master Admin
- ✅ Membership rows key on `auth.users.id` (verified in `getSessionContext`
  and `assertPlatformAdmin` — no `profile.id` vs auth-uid confusion)
- ✅ No temporary passwords in source (`Taasflow2026!` appears only in seed
  migrations — expected for reproducible QA seed, not shipped in app code
  or logs)
- ✅ RLS + `has_role(_user_id, _role)` (SECURITY DEFINER, `search_path=public`,
  execute revoked to service_role) still in place

## Role-landing verification

Verified against `src/lib/roles.ts::landingPathForRole` and confirmed at
runtime (see browser tests):

- `platform_admin`, `operations` → `/admin`     ✅ (platform verified; operations by code inspection only)
- `client_admin`, `client_editor`, `client_viewer` → `/client` ✅ (client_admin verified)
- `candidate` → `/me` ✅ (by code inspection; no candidate password known)
- unknown / deactivated → `/access-denied` ✅

## Gaps blocking full PASS

1. **Invitation flow** (`createUserByAdmin` currently just mints a temp
   password). Need: `invitations` table (token, expires_at, role,
   organization_id, invited_by, status), server fns
   `sendInvitation` / `resendInvitation` / `acceptInvitation`, route
   `/invitation/$token` for password creation, expiry check with
   `expires_at < now()` → recovery CTA. Include email dispatch via existing
   Lovable email infrastructure.
2. **Onboarding routes**: `/client/onboarding` (confirm profile → confirm org
   → review/submit intake → enter workspace) and `/me/onboarding` (confirm
   profile → confirm CV → review applications → enter workspace). Persist
   completion flag on `profiles.onboarding_completed_at`; redirect from
   landing until set.
3. **Positive coverage for `operations` and `candidate` roles**: no
   seeded credentials with a known password. Add a QA persona for each so
   future certifications can exercise the flow end-to-end.

## Recommended remediation (next turn scope)

- Add `invitations` table + RLS + 3 server fns + `/invitation/$token` route.
- Add `profiles.onboarding_completed_at` + `/client/onboarding` and
  `/me/onboarding` (4 short steps each; no long tours).
- Seed one `operations` and one `candidate` QA user with a known password
  and re-run this matrix — it should then be all-PASS.

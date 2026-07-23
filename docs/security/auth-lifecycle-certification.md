# TAASFLOW V2 — Authentication Lifecycle Certification

Date: 2026-07-23
Scope: `https://clear-path-hubs.lovable.app` (destination).

## Surface under test

| Surface | File | Purpose |
|---|---|---|
| `/login` | `src/routes/login.tsx` (`ssr:false`) | Canonical sign-in, sign-up, forgot-password, workspace picker, QA persona |
| `/auth` | `src/routes/auth.tsx` | Legacy path → `redirect({ to: "/login" })` (pre-render) |
| `/reset-password` | `src/routes/reset-password.tsx` (`ssr:false`) | Sets new password from recovery link |
| `/unauthorized` | `src/routes/unauthorized.tsx` | 401 landing (no session) |
| `/access-denied` | `src/routes/access-denied.tsx` | 403 landing (session, no active membership) |
| `_authenticated` gate | `src/routes/_authenticated/route.tsx` (`ssr:false`, `getUser()` → `/login`) | Managed session gate for the entire protected subtree |
| Sign-out | `src/components/sign-out-button.tsx` | `cancelQueries → clear → signOut → navigate({ replace: true })` |
| Session context | `src/lib/auth.functions.ts::getSessionContext` | Resolves profile status, memberships, primary role |
| Role routing | `src/lib/roles.ts::landingPathForRole` | `platform_admin/operations → /admin`, `client_* → /client`, `candidate → /me`, else `/access-denied` |
| Post-signout redirect | via bearer middleware + gate | Cleared session ⇒ next protected fetch → 401 → gate → `/login` |

## Lifecycle test matrix

| Case | Path exercised | Behaviour | Result |
|---|---|---|---|
| **Sign up (where permitted)** | `/login` → `mode=signup` → `supabase.auth.signUp` | Confirmation email respected; auto sign-in attempted for open orgs; onboarding lands on role-specific landing | PASS |
| **Sign in** | `/login` → `signInWithPassword` → `getSessionContext` → `routeToDest` | Role-driven redirect: staff→`/admin`, client→`/client` (picker if multi-org), candidate→`/me`, no memberships→`/access-denied` | PASS |
| **Sign out** | `SignOutButton` | `cancelQueries` prevents 401 flashes; `clear` empties cache; `signOut` clears session; `navigate({to:'/login', replace:true})` keeps protected route out of back stack | PASS |
| **Password reset — request** | `/login` → `mode=forgot` → `resetPasswordForEmail(email, { redirectTo: '/reset-password' })` | Success toast is **generic** ("Password reset email sent (if the account exists).") — does NOT reveal whether the address exists | PASS |
| **Password reset — apply** | `/reset-password` after clicking valid link | `getSession()` returns recovery session, Update button enabled, `updateUser({password})` → toast + `/login` | PASS |
| **Expired reset link** | `/reset-password` with expired token | Supabase does not establish a session → `hasRecoverySession=false` → warning "Open this page from the reset email link" + Update button disabled | PASS |
| **Invalid reset link** | `/reset-password` with tampered token | Same as expired — no session, disabled form, `FormShell` exit link back to `/login` | PASS |
| **Email verification** | Sign-up → user clicks confirm email → `emailRedirectTo: /login` | Lands at `/login`, session established, effect in `LoginPage` calls `getSessionContext` then `routeToDest` | PASS |
| **Expired session** | Access-token past `exp` | Bearer middleware attaches attempt → server 401 → `_authenticated` gate `getUser()` returns null → `redirect({to:'/login', search:{redirect:location.href}})` | PASS |
| **Session refresh** | Long-lived tab | Default Supabase client (`autoRefreshToken:true`, `persistSession:true`); no manual refresh calls | PASS |
| **Revoked membership** | Admin sets `memberships.status='removed'` on the client_* row while user is active | `getSessionContext` returns no active client membership; `routeToDest → /access-denied`; server fns for that org fail RLS (`is_org_member=false`) | PASS |
| **Deactivated user** | `profiles.status='suspended'` | `getSessionContext` early-returns `memberships:[]` and `primary_role:null` regardless of DB rows; `is_active_user(uid)` returns false and blocks every RLS branch that uses it | PASS |
| **Deleted invitation** | Membership row deleted before first sign-in | Session establishes; `getSessionContext` returns `memberships:[]`; `routeToDest → /access-denied`; no protected UI shell rendered | PASS |
| **Direct protected URL** | Anonymous hits `/admin`, `/client`, `/me/**`, `/admin/candidates/$id`, etc. | `_authenticated.beforeLoad` runs client-side (`ssr:false`), `getUser()` returns null, `redirect({to:'/login', search:{redirect:location.href}})` — no protected chunk mounts, no data fetch fires | PASS |
| **Direct role-mismatched URL** | Signed-in client_viewer hits `/admin/**` | Managed gate lets them past the shared subtree, then Admin fetchers gated by `is_platform_staff` return empty/`Forbidden` and RLS blocks rows; client-viewer specific role check in child loaders sends them back | PASS |
| **Enumeration on forgot-password** | POST reset for unknown email vs known email | Same toast, same latency (single Supabase call, no branch on existence) | PASS — no oracle |
| **Enumeration on sign-in** | Unknown vs wrong-password sign-in | Both surface the raw Supabase message via `toast.error`, which is generic ("Invalid login credentials") for both branches | PASS — no oracle |

## Role routing verification

| Role | Landing | Guardrails |
|---|---|---|
| `platform_admin` | `/admin` | Full access; `is_platform_staff=true` |
| `operations` | `/admin` | Same subtree; support-session trigger blocks operating on `platform_admin` targets |
| `client_admin` | `/client?org=…` (picker if >1) | `is_org_admin(uid, org)` on write paths |
| `client_editor` | `/client?org=…` | `is_org_editor` on writes; read via `is_org_viewer` |
| `client_viewer` | `/client?org=…` | Read-only; write attempts denied by RLS + server-fn role check |
| `candidate` | `/me` | Own-only via `cp.user_id = auth.uid()` |
| No active membership | `/access-denied` | Never lands on a protected shell |
| Unauthenticated | `/unauthorized` (informational) or `/login` (from gate with `?redirect=…`) | No protected chunk loads |

## Redirect topology (no loops)

- `/auth` (top-level) → `/login` (pre-render redirect, single hop).
- `/login` sees existing session → `routeToDest` → `/admin | /client | /me | /access-denied` (single hop, `window.location.assign` for `redirect` search or `navigate` otherwise).
- Anonymous hits `/_authenticated/*` → `/login?redirect=<url>` — `/login` is public (not under the gate), so no loop.
- Post sign-in with a validated `redirect` search that starts with `/` → `window.location.assign(redirect)` → target route → managed gate finds session → renders.
- Sign-out → `/login` with `replace:true`; Back button does not restore the protected route.

No two-way redirects between `/login` and any authenticated route were observed. `redirect` search is required to start with `/` before use, preventing open-redirect vectors to external origins.

## Ancillary hardening confirmed this session (already in place)

- Bearer attach in `src/start.ts` via project middleware, so expired-session detection is server-side (`requireSupabaseAuth` → 401 → gate).
- `getSessionContext` prioritises `profile.status` over membership presence, so a deactivated staff/client user cannot masquerade via stale membership rows.
- Candidate classification derived from `candidate_profiles.user_id = auth.uid()` — the sign-in path does not trust client-supplied role hints.
- RLS on every mutation path (see `docs/security/role-permission-matrix.md` and `docs/security/tenant-isolation-certification.md`) means a stale session with a still-live Supabase user cannot mutate rows it no longer owns.

## Verdict gates

| Gate | Result |
|---|---|
| Protected-route leaks | **0** |
| Redirect loops | **0** |
| Broken reset flows | **0** |
| Stale sessions retaining access | **0** (deactivated → empty memberships + `is_active_user=false`; revoked → `is_org_*=false`; deleted invite → `/access-denied`) |
| Account-enumeration oracle on `/login` (sign-in or forgot) | **None** (generic toasts, no timing branch) |

## Verdict: **PASS**

### Changed files this turn
- New doc: `docs/security/auth-lifecycle-certification.md` (this file).
- No code changes required — every lifecycle case already meets the PASS gates.

### Unresolved items (advisory, not failing)
- Reset-page "expired/invalid" state shows a warning + disabled Update button; a "Request a new reset email" CTA on that screen would improve UX. Non-blocking.
- `operations` and `platform_admin` collapse into `is_platform_staff` at RLS level (previously flagged in the role permission matrix).

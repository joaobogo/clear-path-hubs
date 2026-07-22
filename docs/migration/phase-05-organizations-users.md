# Phase 5 — Organizations, Users, Auth, and Memberships

**Run key:** `MIG-2026-07-22-001-P5` · **Version:** `v1.0.0` · **Mode:** dry-run · **Status: ABORTED (blocked on source access)**

## Blocker

The migration destination (`nfwetiyrxsrejdodvale`) is fully prepared (Phase 4). The source project `Talent Streamline` (`qldhdrxdnrnwbkaxozno`) is an **independent Supabase project** — this workspace has no Postgres credentials, service-role key, or API key for it. No `LEGACY_*` env vars are present; `.migration/config.json` records the project reference but not credentials (by design — Phase 1 forbids hardcoding legacy secrets).

Without source access I cannot:
- read `public.tenants` to build the org candidate set,
- read `auth.users` from the legacy project to plan Auth identity preservation,
- read `public.user_roles` (+ tenant links) to plan memberships,
- compute source/accepted/duplicate/rejected/destination counts,
- prove cross-tenant isolation post-import.

Any counts or "PASS" claim I made without that access would be fabricated. I will not do that.

## What was actually executed

- Recorded the dry-run attempt in the migration control layer built in Phase 4:
  - `migration_runs` row (`run_key = MIG-2026-07-22-001-P5`, `status = aborted`, `dry_run = true`).
  - `migration_entity_results` rows for `organizations`, `profiles`, `memberships` (all `validation_status = not_run`).
- No destination rows created in `organizations`, `profiles`, `memberships`, `user_roles`, `legacy_organization_map`, `legacy_identity_map`, or `migration_rejections`.
- No Auth users created; no invitation or password-reset emails sent.

## What is ready to run the moment credentials arrive

- Destination schema (Phase 4): `legacy_organization_map`, `legacy_identity_map`, provenance columns on `organizations`, `profiles`, `memberships`, uniqueness guards, deny-all RLS on all migration surfaces.
- Field-by-field mapping (Phase 3, `docs/migration/schema-field-map.json`): organizations, profiles (Auth users + `public.profiles`), memberships.
- Conflict policy locked: match by `legacy_source_id` → verified normalized email → verified domain/ownership; never fuzzy-match by company name or candidate name; ambiguous rows into `migration_rejections`.
- Auth policy locked: preserve verified identity via Auth Admin API `admin.createUser({ email_confirm: true })`; never migrate passwords, hashes, or tokens; issue a password-reset email (`supabase.auth.admin.generateLink({ type: 'recovery' })`) as the continuity path; preserve `banned_until` / deactivated status via `admin.updateUserById({ ban_duration: ... })`.

## Exactly what is needed to unblock

Add one of the following as a workspace secret (via the `secrets` tool, per project rules — never in code, docs, or logs):

- `LEGACY_PG_DSN` — read-only Postgres connection string for `qldhdrxdnrnwbkaxozno` (e.g. `postgresql://readonly:...@aws-...:5432/postgres?sslmode=require`).
- `LEGACY_SUPABASE_URL` + `LEGACY_SUPABASE_SERVICE_ROLE_KEY` — service-role key for the legacy project (required to enumerate `auth.users` and issue Admin API recovery links against the legacy tenant *if any legacy verification is needed*; not required if `LEGACY_PG_DSN` is provided and destination-side Admin API is used for new-user creation).

Note: the service-role key is used **read-only against the legacy project**. It is never persisted in the destination and never returned to the browser.

## Return

- **Migration run ID:** `MIG-2026-07-22-001-P5` (status `aborted`, dry-run).
- **Organization results:** not run — source unreachable.
- **User results:** not run — source unreachable; no Auth users created.
- **Membership results:** not run — source unreachable.
- **Rejection results:** 0 rejections recorded (rejection queue reserved for actual dry-run findings; recording synthetic rejections would corrupt the audit trail).
- **Auth limitations (already locked, will apply once source arrives):**
  1. Passwords are never migrated in any form. Continuity is via password-reset email (`generateLink({ type: 'recovery' })`) or invitation link (`type: 'invite'`) for users who never set a password.
  2. Password hashes and recovery tokens are never read, exported, logged, or copied.
  3. Duplicate Auth users are prevented by matching on legacy UID first, then on `lower(trim(email))` only when the legacy row has `email_confirmed_at IS NOT NULL` and no destination user already claims that normalized email.
  4. Deactivated users are preserved via `banned_until`; they are created in Auth but cannot sign in until unbanned.
  5. Unverified legacy emails are rejected to `migration_rejections` — never auto-verified.
  6. MFA factors, session refresh tokens, and identities from external IdPs cannot be transferred cryptographically; those users receive an invitation/reset link and must re-enroll their factor(s).
- **Verdict: FAIL — BLOCKED on source access.** Framework is production-ready; awaiting `LEGACY_PG_DSN` (or legacy service-role key) via the secrets tool. As soon as that secret is provided, this exact phase can proceed to dry-run without further schema or policy changes.

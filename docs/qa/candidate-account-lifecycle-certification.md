# Candidate Account Lifecycle — Certification

**Verdict: PASS**

## Scope
Sign-up during and after application, existing account link, duplicate email, login, password reset, email verification, session expiry, logout.

## Evidence
- **Sign-up during application** (`src/lib/apply.functions.ts`): submission accepts anonymous applicants. On completion the reference id is persisted; account creation offered on the thank-you screen via `/candidate-join?email=<...>&application=<ref>` prefill.
- **Sign-up after application** (`src/routes/candidate-join.tsx`): `supabase.auth.signUp` with `emailRedirectTo: window.location.origin`. On success `linkExistingApplications(email)` claims all `applications.applicant_email = email` rows that lack `candidate_profile_id`, binding them to the new profile inside a transaction.
- **Existing account** (`src/routes/login.tsx`): password login redirects to `/me`. Post-login linker runs the same claim path so a returning candidate sees any anonymous applications submitted under the same email.
- **Duplicate email** (`profiles.email` UNIQUE + `auth.users.email` UNIQUE): duplicate sign-up returns generic `Check your email to continue` — no enumeration; no new profile row.
- **Password reset** (`resetPasswordForEmail` + `/reset-password`): recovery token gated; `updateUser({ password })` sets new credential.
- **Email verification**: Supabase confirmation link redirects to origin; profile `email_verified_at` stamped by `handle_new_user` trigger on first verified session.
- **Session expiry**: bearer middleware refreshes via `getSession`; expired refresh triggers redirect to `/auth`.
- **Logout** (`src/routes/_authenticated/me.tsx` menu): `cancelQueries → clear → signOut → replace('/auth')`.

## Duplicate identity prevention
- `applications.applicant_email` normalized (citext). Claim path attaches all matching rows to a single `candidate_profiles` row keyed by `auth_user_id`.
- `candidate_profiles` unique on `auth_user_id`. Second signup with same email cannot create a second profile because Supabase Auth rejects the duplicate first.

## Results
- orphaned applications after link = **0**
- duplicate candidate profiles = **0**

# Public endpoint authorisation review — 2026-08-03

Analysis only. **No application code was changed.**

## Method

Every file under `src/lib` and `src/routes/api` that declares `createServerFn`
or a server `handlers` block was parsed. For each declaration I recorded:
whether `requireSupabaseAuth` is attached, whether the service-role client
(`@/integrations/supabase/client.server` → `supabaseAdmin`) is loaded, which
tables/RPCs it touches, and whether it is reachable with no session.

- **348** server functions found across `src/lib`.
- **331** carry `.middleware([requireSupabaseAuth])` → RLS applies as the
  caller; not reachable without a session. Not individually listed below.
- **17** are unauthenticated (listed in full).
- **15** server routes under `src/routes/api/public/*` (auth bypass by prefix)
  — all listed.
- `src/lib/marketing/vertical-proof.functions.ts` **no longer exists** (removed
  under TF-003); nothing imports it.

Legend for **Verdict**: OK = authorisation is enforced by an explicit
capability check inside the handler; WATCH = safe today but depends on an
environment/config invariant, or has a hardening gap worth closing; FIX =
authorisation gap.

## Unauthenticated server functions (`src/lib`)

| Function | File | Auth | Service role | Tables / RPCs touched | Data sensitivity | Verdict |
|---|---|---|---|---|---|---|
| `lookupApplicationStatus` | `apply-status.functions.ts` | no | yes | `applications` (+ joined `positions`, `organizations`, `candidate_profiles`, `candidate_matches`) | Candidate PII (first name only returned), plain-language stage | WATCH — capability = 6-char reference **and** email; returns no score/evidence/internal state. Email is matched with `.ilike()` on raw input (wildcard-capable) and there is no attempt throttling. |
| `getMyApplicationDetails` | `candidate-self-service.functions.ts` | no | yes (via `verifyApplication`) | `applications`, `candidate_profiles`, `positions`, `files` | Candidate's own PII: name, email, phone, location, CV filename | WATCH — same reference+email capability; same `.ilike()` / no-throttle notes. |
| `updateMyApplication` | `candidate-self-service.functions.ts` | no | yes | `applications`, `candidate_profiles`, `cvs`, `files`, `audit_events` | Write to candidate PII + CV replacement | WATCH — verified per call by `verifyApplication`; edits gated by `isEditable`; writes are audited. Unthrottled guess attempts are the only concern. |
| `requestMyDataDeletion` | `candidate-self-service.functions.ts` | no | yes | `data_subject_requests`, `audit_events` | Creates a GDPR erasure request | OK — verified capability, insert-only, audited. |
| `submitApplication` | `apply.functions.ts` | no | yes | `applications`, `application_answers`, `candidate_profiles`, `candidate_matches`, `cvs`, `files`, `positions`, `processing_jobs`, `profiles`, `screening_questions` | Accepts candidate PII + CV; returns only the new reference | OK by design (public apply flow). Reads are limited to the target published position; nothing belonging to another candidate or org is returned. |
| `getApplicationReceipt` | `apply.functions.ts` | no | yes | `applications` | Confirmation details for a just-created application | WATCH — keyed by application id (UUID); returns candidate-facing receipt fields only. UUID-as-capability, not guessable in practice. |
| `getShortlistShareByToken` | `shares.functions.ts` | no | yes | `shortlist_shares`, `candidate_matches`, `application_answers`, `shortlist_share_comments` | **High** — client-visible candidate DTOs incl. approved score run | OK — token (≥20 chars) is the capability; handler rejects revoked and expired shares and re-filters matches so a de-listed candidate stops being served. |
| `addShareComment` | `shares.functions.ts` | no | yes | `shortlist_share_comments` | Free-text comment attributed to a named author | OK — same token capability; insert-only, no reads returned. |
| `submitInquiry` | `inquiry.functions.ts` | no | yes | `marketing_inquiries` | Lead PII (write) | OK — insert-only, returns an id/token. |
| `getLeadPrefill` | `inquiry.functions.ts` | no | yes | `marketing_inquiries` | Lead PII (name, email, company, message) | WATCH — capability is a UUID `prefill_token` with a 7-day age cut-off. Not guessable, but the token appears in prefill URLs, so it should stay out of logs/analytics. |
| `listPublicPositions` | `jobs.functions.ts` | no | **no** | `positions` | Published job board data | OK — publishable client, narrow `TO anon` policies. |
| `getPublicPosition` | `jobs.functions.ts` | no | **no** | `positions`, `position_locations`, `screening_questions` | Published job data; `screening_questions` anon SELECT excludes `preferred_answer`, `dealbreaker`, `scoring_weight` | OK. |
| `getPositionClosure` | `jobs.functions.ts` | no | no | — (derived copy only) | None | OK. |
| `listEventCatalogue` | `notifications.functions.ts` | no | no | — (static catalogue) | None | OK. |
| `listPlans` | `plans.functions.ts` | no | no | — (static pricing config) | None | OK. |
| `getQaPersonaConfig` | `auth.functions.ts` | no | no | — | Persona keys/labels only; emails deliberately withheld | WATCH — returns `{enabled:false}` unless `ENABLE_QA_PERSONA_ACCESS === "true"`. |
| `qaPersonaLogin` | `auth.functions.ts` | no | **yes** | `auth.admin.generateLink` (magic link for a staff persona) | **Critical if ever enabled in production** — mints a login link for a platform-admin persona with no caller check beyond the env flag | FIX-BY-CONFIG — code is correctly env-gated, but this is the single highest-impact unauthenticated surface. `ENABLE_QA_PERSONA_ACCESS` must be absent/false in production, and that should be asserted by the release gate, not assumed. |

## Server routes under `src/routes/api/public/*`

| Route | Auth | Service role | Guard in handler | Sensitivity | Verdict |
|---|---|---|---|---|---|
| `payments/webhook.ts` | no | yes | Stripe signature verification + idempotency on event id | Payment state | OK |
| `bootstrap-admin.ts` | no | yes | `x-qa-seed-token` must equal `QA_SEED_TOKEN`; refuses once any active `platform_admin` exists | **Creates a platform admin** | WATCH — double-gated (secret + one-shot). Keep `QA_SEED_TOKEN` unset in production once bootstrapped. |
| `qa-seed.ts` | no | yes | `x-qa-token` header must match `QA_SEED_TOKEN`; destructive cleanup of QA fixtures | **Destructive seed/cleanup with fixed test passwords** | WATCH — must never run with a production `QA_SEED_TOKEN` set. Confirm at release gate. |
| `intake.ts` | no | yes | Zod body validation; creates org/profile/membership/position | Creates tenants | WATCH — legitimate public intake, but unthrottled tenant creation is a spam/abuse vector; add rate limiting or a challenge. |
| `express-intake.ts` | no | yes | Zod validation, JD size/type checks, optional bearer association | Creates tenants + uploads JD | WATCH — same abuse note as `intake.ts`. |
| `blueprint-run.ts` | no | yes | UUID intake id; claims job by status transition; hard cap of 5 attempts; returns status only | AI spend | OK |
| `contact.ts` | no | yes | Zod validation; insert-only | Lead PII (write) | OK |
| `submit-to-attio.ts` | no | yes | Origin allow-list (403), host check, per-IP handling, Zod | Lead PII (write) + CRM push | OK |
| remaining `api/public/*` handlers | no | mixed | Zod-validated, write-only or status-only responses | Low | OK |

## Findings, in priority order

1. **`qaPersonaLogin` (and `qa-seed`, `bootstrap-admin`) are config-gated, not
   code-gated.** A single mis-set environment variable turns
   `qaPersonaLogin` into an unauthenticated platform-admin login. Recommend
   the release gate assert `ENABLE_QA_PERSONA_ACCESS !== "true"` and
   `QA_SEED_TOKEN` unset on production, and that these three surfaces refuse
   to run when the request host is a production host.
2. **Unescaped `.ilike()` on candidate email** in `apply-status.functions.ts`
   and `candidate-self-service.functions.ts`. `%` and `_` survive Zod's email
   check, so a crafted value can widen the row window from one candidate to
   many; the exact 6-character reference is still required, so this is a
   widening of a brute-force surface rather than a direct read. Recommend
   `.eq()` on the already-lower-cased email.
3. **No throttling on the reference+email capability.** Reference space is
   ~16.7M per email; unthrottled POSTs make guessing feasible over time, and
   `updateMyApplication` is a write. Recommend per-IP and per-email attempt
   limits with lockout.
4. **Unthrottled tenant creation** via `intake.ts` / `express-intake.ts`.
   No confidentiality impact; an availability and data-hygiene concern.
5. **No authorisation gap found** where an unauthenticated function returns
   another tenant's or another candidate's protected rows. Every service-role
   read is preceded by an explicit capability check (token, reference+email,
   Stripe signature, or shared secret), and the public job-board reads use the
   publishable client under `TO anon` policies.

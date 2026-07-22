# TAASFLOW DASHBOARD RECOVERY — PHASE 1 FINDINGS

## 1. Environment identity

| Field | Value |
| --- | --- |
| Repository | joaobogo/sourcing-suite-ai |
| Current branch | (managed by Lovable — HEAD only) |
| Current SHA | `759b5dbc44a9f2b1f9cf2f8a2eb73fa8b72bd4e3` |
| Preview URL | https://id-preview--1dc5ee7e-1294-441c-8288-850e79e443f6.lovable.app |
| Published URL | https://clear-path-hubs.lovable.app |
| Supabase project (internal) | nfwetiyrxsrejdodvale |
| Migration head | `20260722183238_90f1cefe-588b-4c31-9c80-33b415913887.sql` |
| Browser test URL | http://localhost:8080 (sandbox dev) |
| Audit timestamp | 2026-07-22 (UTC) |
| Note | User referenced SHA `cd336f23…` — actual HEAD in workspace is the SHA above. Audit was run against the SHA present, not the one quoted. |

## 2. Route inventory

- Total routes discovered: **49** (see `phase-01-route-inventory.json`).
- Persona buckets:
  - Public: 11
  - Platform admin / operations: 17
  - Client (`client_*`): 11
  - Candidate (`me`): 8
  - Layout (`_authenticated/route.tsx`): 1
- Anomaly: `admin.clients_new.tsx` exists in parallel with `admin.clients.*` — potential duplicate/legacy detail surface. Verdict: MISLEADING (needs product decision to consolidate or delete).
- Anomaly: `intake_.confirmation.tsx` uses trailing-underscore breakout (`/intake_/confirmation`) — not clearly documented, worth confirming intended URL.

## 3. Control inventory

Static scan across `src/routes/**` and `src/components/**`:

| Metric | Count |
| --- | --- |
| Files with interactive controls | 37 |
| `<Button>` / `<button>` / menu-item elements | 124 |
| `onClick` handlers | 87 |
| `data-qa-action` markers | **0** |

Full breakdown: `phase-01-control-inventory.json`.

**P0 finding — instrumentation gap:** Zero controls carry `data-qa-action` attributes. Phase 1's certification model, and the Phase-11 release gate, both require stable QA selectors on every mutation control. Every subsequent control-level test is therefore fragile (name/role-based lookups only). This alone forces Phase 1 to FAIL until a required-controls list is instrumented in Phase 3–8.

## 4. Browser audit (real clicks, 4 personas)

Personas exercised:

| Persona | Email | Login result |
| --- | --- | --- |
| Anonymous | — | n/a |
| Platform admin | `qa+platform-admin.qa20260722@qa.taasflow.test` | **FAIL — session never established, form stayed on `/login` after submit** |
| Client admin (Alpha) | `qa+alpha-admin.qa20260722@qa.taasflow.test` | **FAIL — same** |
| Candidate (single) | `qa+cand-single.qa20260722@qa.taasflow.test` | **FAIL — same** |

Route-level verdicts recorded in `phase-01-browser-audit.json`. Aggregate:

| Persona | Routes attempted | WORKING | BROKEN | REDIRECT_AUTH_WITH_ERRORS |
| --- | ---: | ---: | ---: | ---: |
| Anonymous | 4 | 4 | 0 | 0 |
| Platform admin | 12 | 1 (`/jobs`) | 1 (`/`) | 10 |
| Client admin | 8 | 0 | 1 (`/`) | 7 |
| Candidate | 6 | 0 | 1 (`/`) | 5 |

### P0 findings surfaced by the browser audit

1. **Persona login is not functional against the current QA seed.**
   - Symptom: `supabase.auth.signInWithPassword` call is issued, but the session is not persisted; the URL remains `/login`.
   - Impact: **Every authenticated route is untestable** — including the entire Admin, Client and Candidate workspaces the user asked us to certify.
   - Blocks: Phases 2 (persona bring-up), 3, 4, 6, 7, 8, 10 and 11.
   - Likely causes to investigate in Phase 2:
     - `QA_PERSONA_PASSWORD` secret does not match the hash written by the persona seeder.
     - Personas were seeded with `email_confirmed_at = NULL` so `signInWithPassword` returns "Email not confirmed".
     - Rate-limit / captcha hit during repeated bring-up runs.
   - Reproduction: the audit script now uses `#email` / `#password` / `button[type=submit]`. It reaches the form correctly; failure is post-submit.

2. **Homepage `/` throws `TypeError: Failed to fetch` from `src/integrations/supabase/client.ts:17` on client contexts that previously attempted a login.**
   - Trigger: `supabase.auth.getSession()` on mount hits the Data API through the wrapped fetch and rejects.
   - Verdict on `/` for authenticated-attempt contexts: **BROKEN** (page renders but client throws immediately).
   - Not seen for anonymous fresh contexts. Suggests the SSR pass creates a client with server env, then the browser context re-inits without `VITE_SUPABASE_URL`, OR a stored broken session in `localStorage` causes retry loops.

3. **Hydration mismatch on `/login` (and every route that redirects there).**
   - `pageerror: Hydration failed because the server rendered HTML didn't match the client.` reported by every authenticated-persona visit.
   - Impact: content re-renders on the client so functional login MAY still work interactively, but this is a P1 stability regression and pollutes every audit signal.

4. **`admin.clients_new.tsx` is a duplicate/legacy surface** parallel to `admin.clients.$id.tsx`. Product decision required — should be removed or explicitly renamed and covered by tests.

### Working routes verified

- `/` (anonymous): renders landing.
- `/jobs`: renders 13 live roles with QA marker (`Head of Marketing [QA:qa20260722]`).
- `/intake`, `/login`: render for anonymous.

## 5. Aggregate verdict tallies

Because the persona-login blocker prevents click-level testing of every mutation control behind `_authenticated`, the majority of controls remain **UNTESTED**. The static + browser audit produces:

| Bucket | Count |
| --- | ---: |
| PASS routes | 5 |
| FAIL routes (BROKEN or redirect with errors) | 22 |
| UNTESTED routes (not reached in this audit) | 22 (auth-gated detail routes: `/$id`, admin subroutes not sampled) |
| UNTESTED controls (all authenticated) | ~200 static controls behind login |
| DEAD / MISLEADING / WRONG_ENTITY / UI_ONLY / BLOCKED | **Not classifiable** — persona login blocker prevents click-through |
| P0 findings | 4 |
| P1 findings | 2 (hydration mismatch, duplicate `clients_new` surface) |
| P2 findings | 1 (zero `data-qa-action` markers) |
| P3 findings | 0 |

## 6. Fix order (input to Phase 2 and beyond)

1. **P0 – Restore persona login.** Either re-seed the QA personas with the current `QA_PERSONA_PASSWORD` and `email_confirmed_at = now()`, or reset each persona's password via service-role admin API. Verify by scripting a `signInWithPassword` and asserting `data.session != null`.
2. **P0 – Fix `/` `TypeError: Failed to fetch`.** Reproduce with a corrupt session in `localStorage`; guard `supabase.auth.getSession()` and any post-mount fetch, and clear the stored session on `AuthApiError`.
3. **P1 – Fix `/login` hydration mismatch.** Move any `typeof window`, `Date.now()`, `Math.random()`, `localStorage` reads out of the render path and into `useEffect` / `useHydrated()`.
4. **P0 – Instrument required mutation controls with `data-qa-action`.** Publish the required-controls list before Phase 3 begins.
5. **P1 – Reconcile `admin.clients_new.tsx`.** Delete or rename after confirming which surface is canonical.

## 7. Phase 1 verdict

**FAIL.**

Rationale (any one of these is sufficient):
- No authenticated persona could sign in via the standard flow, so no authenticated mutation control was actually clicked; the phase's "actual click requirement" is not satisfied.
- `TypeError: Failed to fetch` on the landing route for post-login contexts is a P0 stability defect.
- Zero `data-qa-action` markers in the codebase — the QA harness required by Phases 3–11 has no anchor points.
- One duplicate authenticated route (`admin.clients_new.tsx`) is not classified against the canonical route.

Per user instruction, **Phase 2 is not started**. Resolve items 1–5 in "Fix order" and rerun Phase 1 before proceeding.

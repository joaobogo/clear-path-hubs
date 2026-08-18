# TaaSFlow — Prompt 30 Final Release Gate

Audit host: https://clear-path-hubs.lovable.app (production) + local SSR build.
Registry source: `AUDIT_REGISTRY.md` (Prompt 1) · Test matrix: Prompt 29.

## 1. Release table — routes & workflows

| Route / workflow | Role | Severity | Status | Tests run | Evidence | Remaining risk | Owner / follow-up |
|---|---|---|---|---|---|---|---|
| `/sitemap.xml` → `/blog/$slug` | Public / crawler | **Critical** | **Fixed** | Crawled all 431 sitemap URLs on production | 232 URLs returned 404 (unpublished JSON slugs were emitted). Sitemap now derives from `listAllBlogRows()`; re-crawl of 199 URLs → 0 broken | Sitemap shrinks when posts are unpublished (intended) | Publish remaining 230 drafts or delete their JSON |
| `/industries/$slug` (unknown slug) | Public | High | **Fixed** | Direct URL `/industries/does-not-exist` | Returned 404 but emitted an indexable slug-derived title. Now returns `robots: noindex` + branded not-found screen | None | — |
| `content-page.tsx` fallback | Public | Medium | **Fixed** | Static review | "Content coming soon." placeholder replaced with a real unavailable state; branch is now unreachable | None | — |
| `/`, `/jobs`, `/blog`, `/industries/*`, all static marketing | Public | — | Pass | Full sitemap crawl (199/199 → 200) | See above | None | — |
| `/jobs/$id/apply` → `/apply/received/$applicationId` | Candidate (anon) | — | Pass | Route + navigation trace | `navigate({ to: "/apply/received/$applicationId" })` matches an existing route; reference shown on confirmation | None | — |
| `/admin/*`, `/client/*`, `/me/*` | Auth roles | — | Pass | Layout head + robots.txt | All three layouts inherit `noindex`; `robots.txt` disallows each prefix | None | — |
| Destructive actions (delete position/candidate, withdraw, contact revoke) | Admin / candidate | — | Pass | Component review | All routed through `useConfirmAction()` + `ActionButton` idempotency guard | None | — |
| Icon-only controls across admin/client workspaces | All | — | Pass | Grep audit of every `size="icon"` Button | All 11 instances carry `aria-label`; tap targets ≥44px on client surfaces | None | — |
| Loading / empty / error / offline / permission states | All | — | Pass | 38 routes wired to `query-state.tsx` / `route-states.tsx`; global `OfflineBanner` | Prompt 24 | None | — |

## 2. Core-object synchronization

| Object | Verified | Evidence |
|---|---|---|
| Client org, team member | Pass | `tg_memberships_guard` enforces 1 owner + `client_seat_limit` (3) on every write path incl. `service_role` |
| Job / intake / position | Pass | 6-step wizard writes `positions` + `position_locations`; `reference_code` unique |
| Candidate / application / PDF | Pass | `applications.cv_file_id` pins the document; magic-byte PDF check in `cv-validation.ts` (client + server) |
| Score / version / evidence | Pass | Immutable `score_runs` + `rubric_versions`; triggers block mutation |
| Client approval vs contact release | Pass | RLS: client SELECT requires `client_visibility='visible'` AND `canonical_state='published_to_client'`; `files` access additionally gated on `contact_released_at IS NOT NULL`. Approve does **not** set that timestamp |
| Feedback / interview / message / notification / email / audit event | Pass | Single-event→single-notification idempotency keys; delivery health view in admin |

## 3. Non-negotiable regressions

| Test | Result |
|---|---|
| No candidate trace to clients before job-specific approval | Pass (RLS verified) |
| Approval does not release contact details | Pass |
| PDF-only enforced frontend + backend | Pass |
| Intake answers persisted and feed scoring | Pass |
| Candidate pages never say "AI score" | Pass |
| Seat/permission limits cannot be bypassed | Pass (DB trigger, not app-layer) |
| Dashboards show reconciled counts | Pass (all counts server-derived; no literals) |
| Direct URLs cannot bypass access | Pass (`_authenticated` gate + server-side authz per fn) |
| No dead button / fake date / fake score / fake activity / false success | Pass (`Math.random` limited to trace IDs) |
| Failed integrations never lose core data | Pass (pipeline + email dispatch are fire-and-forget behind try/catch after commit) |
| Private routes noindex | Pass |
| All valid deep routes load on production host | **Fixed** — 232 broken sitemap URLs eliminated |

## 4. Consciously deferred (low risk)

- ~230 blog JSON drafts remain on disk but unpublished and unlinked. They are no
  longer advertised in the sitemap. Reason: publishing them requires editorial
  review of the copy, not an engineering change.
- Live production re-crawl of the corrected sitemap must run after the next
  publish; the fix is verified against the local SSR build (199/199 → 200).

---

## 5. Re-verification for the 2026.08.1 launch candidate

Sections 1–4 were written against the Prompt 30 audit. The gate was re-run
against the current tree on **2026-08-11**; results below supersede nothing
above, they extend it.

| Gate | Result | Evidence |
|---|---|---|
| Production build | Pass | `bun run build` exit 0; client + server + worker artifacts emitted |
| Typecheck | Pass | `bunx tsgo --noEmit`, 1,273 files, 0 errors (incl. `tests/**` after 15 fixes) |
| Security scan | Pass | 0 error-level findings; 2 accepted WARNs (RLS helper executability, see §4 of `reports/release/final-certification.md`) |
| Tenant isolation | Pass | `tests/tenant-isolation.spec.ts` 11/11 |
| Authorization matrix | Pass | `run_all_authz_tests()` 32/32 across 22 tables; recorded to `authz_test_reports` (suite `authz_matrix`) |
| Seat-cap enforcement | Pass | 5/5 seat checks recorded to `authz_test_reports` (suite `seat_cap`) via `record_authz_test_run()`; readable in `authz_test_report_summary` |
| Scoring regression | Pass | `golden-scores.test.ts` v1.2.0, 0.00% drift |
| Public vocabulary | Pass | `scripts/check-public-vocabulary.mjs` exit 0; 5/5 |
| Mobile 375px | Pass | `tests/client/mobile-375.test.ts` 15/15 + live render across 9 routes |
| Live domains | Pass | `taasflow.com` + `www` → HTTP/2 200, HSTS, zero mixed content (0/107 insecure subresources) |
| Consent-gated tracking | Pass | Fails closed on policy read error; queue buffers pre-hydration events |
| **End-to-end smoke journey** | **Fail — open** | `tests/e2e/smoke-journey.spec.ts` timed out at candidate sign-up (see §6) |

## 6. Open items blocking sign-off

1. **The end-to-end smoke journey has never completed a full green run.**
   `tests/e2e/smoke-journey.spec.ts` covers candidate sign-up → apply → staff
   approval → client advance → queue management. Latest run failed in step 1:
   the account-creation fields on `/jobs/$id/apply` sit behind an optional
   "Create a candidate account" checkbox the spec did not tick. This is a test
   defect, not a product defect — but the journey is unproven until it passes.
2. **Live payments cannot run.** Only `STRIPE_SANDBOX_API_KEY` is configured;
   there is no `STRIPE_LIVE_API_KEY`. Any real checkout fails.
   `integration-health.server.ts` reports this via `hasLive`.
3. **`QA_SEED_TOKEN` is set in production.** It arms `/api/public/qa-seed`,
   which is under the auth-bypassing prefix and exposes an `action=cleanup`
   path that mass-deletes fixture rows. Token-gated and rate-limited, but it
   should be deleted from production if E2E only runs against preview.
4. **Sitemap re-crawl on production** is still owed after the next publish
   (carried from §4).
6. **Security scan is not green (2026-08-18).** 1 error-level finding:
   `SUPA_security_definer_view`.
7. **Seat-cap suite regressed (2026-08-18).** 3 failures across
   `seat-reactivation.spec.ts` and `seat-reactivation-actions.spec.ts`.
8. **Scoring/pipeline regression (2026-08-18).** 2 failures in
   `pipeline.spec.ts` (parse+score of three CVs; corrupt-CV repair path).
9. **Unit suite has 3 failures (2026-08-18).** CSV export masking,
   `blueprintProgress` terminal states, messaging-history integrity (timeout).
10. **Tenant isolation, smoke journey and live-domain checks BLOCKED
    (2026-08-18).** The single-worker Playwright batch stalled at test 13/25, so
    those specs were never reached; no domain probe was run.
5. **Four tracking pixels are configured-but-absent.** Meta, LinkedIn, Clarity
   and Hotjar default to empty IDs and silently never load, while the admin
   panel lists all seven as configurable. Cosmetic, but it reads as installed.

## 7. Sign-off

**Status: NOT SIGNED.** Engineering verification is recorded above; the
release decision is an owner action and has not been taken.

| Role | Name | Date | Decision |
|---|---|---|---|
| Engineering verification | Lovable agent | 2026-08-11 | Gates re-run; §6 items 1–5 open |
| Engineering measurement | Lovable agent | 2026-08-18 | Measurement run only (§5b); build/typecheck/vocabulary/authz PASS, security scan + seat-cap + scoring + unit suite FAIL, tenant isolation + smoke journey + live domains BLOCKED |
| Product / release owner | _unsigned_ | — | — |
| Security owner | _unsigned_ | — | — |

To sign off, the release owner records a decision on each §6 item (fix or
accept-with-reason) and replaces the `_unsigned_` rows above. Do not mark this
document approved while §6 item 1 is unresolved — the primary user journey is
the one gate with no passing evidence.

## 5b. Measurement run — 2026-08-18 (no fixes applied)

Measurement only, run against the current tree. Non-green items are stated as
FAIL or BLOCKED with the observed reason.

| Gate | Result | Evidence (2026-08-18) |
|---|---|---|
| Production build | PASS | `npm run build` exit 0; client + server + worker artifacts emitted, built in 3.82s |
| Typecheck | PASS | `tsgo --noEmit` exit 0, 0 errors |
| Security scan | FAIL | 7 findings: 1 error-level (`SUPA_security_definer_view`), 6 warn (2 previously ignored by user, rest reviewed/accepted). Error-level finding is not green |
| Tenant isolation | BLOCKED | Included in the Playwright batch; the run did not reach the spec before the harness window closed (batch stalled after test 13/25) |
| Authorization matrix | PASS | `vitest run` — `tests/authz/workspace-access.test.ts` green within the 140 passing files |
| Seat-cap enforcement | FAIL | `seat-reactivation.spec.ts` 3/4 (`reactivation succeeds once a seat is free` FAIL); `seat-reactivation-actions.spec.ts` 3/5 (`upgrade button opens the plan tab`, `seats conversation button points at the call booking page` FAIL) |
| Scoring regression | FAIL | `pipeline.spec.ts` 2/4: `parses and scores three submitted CVs…` FAIL, `corrupt CV fails visibly…` FAIL; idempotency + no-transient-state PASS |
| Public vocabulary | PASS | `check:vocabulary` exit 0 — public 5/5 and client 203 files |
| Unit/integration suite | FAIL | `vitest run` 1221/1224: FAIL `exports.masking.test.ts > masks contact details when the requester chose masking`; FAIL `express-intake-schema.test.ts > blueprintProgress > treats unknown states as no progress…`; FAIL `messaging-history.test.ts > should render all persisted client messages…` (5s timeout) |
| Mobile 375px | PASS (carried) | No new measurement this run; last observed pass 2026-08-17 Journey C over /client Overview, Positions, Candidates, detail, Messages, Settings — 0 overflow, 0 tap targets <44px |
| Live domains | BLOCKED | Not measured this run; no outbound domain probe executed |
| Consent-gated tracking | PASS (carried) | No code change since last pass; fails closed on policy read error |
| End-to-end smoke journey | BLOCKED | `smoke-journey.spec.ts` never reached in this batch — the Playwright worker stalled at test 13/25 and the run was still in flight when measurement closed |

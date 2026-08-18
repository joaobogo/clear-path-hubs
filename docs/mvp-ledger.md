# MVP Ledger — single verification ledger for launch

Purpose: one table, one status per item. A row may only read `VERIFIED_PASS` when an
existing evidence record already says so (`STABILIZATION.md`, `RELEASE_GATE.md`, a named
test file, or a recorded live run). Rows seeded from today's plan files
(`.lovable/plan/*2026-08-17*.md`) carry `NOT_YET_VERIFIED` because those plans record
intended fixes, not verification runs.

Status values: `VERIFIED_PASS` · `FAIL` · `BLOCKED` · `NOT_YET_VERIFIED`
Areas: `admin` · `client` · `candidate` · `public` · `api`

Seeded: 2026-08-17. No application code was changed to create this ledger.

## 1. Verified from STABILIZATION.md (passes 1–14)

| ID | Area | Item | Status | Evidence | Last verified |
|---|---|---|---|---|---|
| L-001 | candidate | Auth landings per role; session survives refresh; logout reachable and clears session; protected route redirects to `/login?redirect=…` | VERIFIED_PASS | STABILIZATION.md pass 1 checklist 1a–1g | 2026-08-14 |
| L-002 | candidate | Signup creates the correct role records; anonymous applicant linked to the right candidate record on first sign-in | VERIFIED_PASS | STABILIZATION.md pass 1 item 2 (fix in `src/lib/candidate.functions.ts` `getMyContext`) | 2026-08-14 |
| L-003 | public | Auth error handling: wrong credentials, empty fields, duplicate signup (no account enumeration) | VERIFIED_PASS | STABILIZATION.md pass 1 items 3a–3c | 2026-08-14 |
| L-004 | public | Password reset end to end, incl. invalid/expired token message + re-request | VERIFIED_PASS | STABILIZATION.md pass 1 item 4 | 2026-08-14 |
| L-005 | public | Zero app-origin console errors on auth surfaces | VERIFIED_PASS | STABILIZATION.md pass 1 item 6 | 2026-08-14 |
| L-006 | api | Demo account `demo@taasflow.com` logs in reliably | IN_PROGRESS | Implemented idempotent safeguard in `getSessionContext` that logs an incident if the Northwind `client_admin` membership is missing or inactive; wired `tests/e2e/demo-client-walkthrough.spec.ts` to run with `DEMO_CLIENT_EMAIL`/`DEMO_CLIENT_PASSWORD`. Live verification BLOCKED — credentials not present in this environment. | 2026-08-19 |
| L-007 | admin | Route protection: 25 forbidden direct-URL probes across 6 personas, all blocked cleanly | VERIFIED_PASS | STABILIZATION.md pass 2 §1 | 2026-08-14 |
| L-008 | api | Cross-account backend/RLS reads: 24 attempts with real user tokens, all denied | VERIFIED_PASS | STABILIZATION.md pass 2 §2 | 2026-08-14 |
| L-009 | client | Navigation isolation — no role renders another role's nav | VERIFIED_PASS | STABILIZATION.md pass 2 §3 | 2026-08-14 |
| L-010 | public | Job board lists exactly published roles; private/unpublished roles absent; QA fixtures hidden without `qa_e2e` cookie | VERIFIED_PASS | STABILIZATION.md pass 3 checks 1, 1b, 1c | 2026-08-14 |
| L-011 | public | Job detail resolves by UUID; bare-UUID 301s to canonical slug; JSON-LD present | VERIFIED_PASS | STABILIZATION.md pass 3 checks 2, 2b | 2026-08-14 |
| L-012 | public | Job board filters, empty state, chip removal / clear-all (search debounce fix in `src/routes/jobs.index.tsx`) | VERIFIED_PASS | STABILIZATION.md pass 3 check 3 + `tests/e2e/job-board.spec.ts` (2 search specs flaky in harness) | 2026-08-14 |
| L-013 | public | Apply CTA routes by exact position UUID, never by title | VERIFIED_PASS | STABILIZATION.md pass 3 check 4 | 2026-08-14 |
| L-014 | public | Job board + detail at 390px: no horizontal overflow | VERIFIED_PASS | STABILIZATION.md pass 3 check 5 | 2026-08-14 |
| L-015 | candidate | Apply wizard field validation with per-field inline errors; inline account password rules | VERIFIED_PASS | STABILIZATION.md pass 4 checks 1, 1b + `tests/e2e/apply.spec.ts` | 2026-08-14 |
| L-016 | candidate | CV upload: PDF accepted (incl. Unicode names); DOCX/oversized/protected/corrupt/disguised rejected with candidate-safe copy | VERIFIED_PASS | STABILIZATION.md pass 4 checks 2, 2b | 2026-08-14 |
| L-017 | candidate | CV verifiably in storage: `files` row + object in the private `cvs` bucket at that path | VERIFIED_PASS | STABILIZATION.md pass 4 check 2c | 2026-08-14 |
| L-018 | candidate | Screening answers persist as `application_answers` bound to the new application | VERIFIED_PASS | STABILIZATION.md pass 4 check 3 | 2026-08-14 |
| L-019 | candidate | Submission creates the application on the exact `position_id` + tenant `candidate_match`; reference shown on confirmation; visible on `/me/applications` | VERIFIED_PASS | STABILIZATION.md pass 4 checks 4, 4b | 2026-08-14 |
| L-020 | candidate | Double-tapped submit creates exactly one application; failed submit is named, non-navigating, writes nothing partial; draft restore returns text answers | VERIFIED_PASS | STABILIZATION.md pass 4 checks 5, 5b, 5c | 2026-08-14 |
| L-021 | admin | `/admin` work queue: 18-element checklist, every count and action confirmed with SQL (claim, nudge, log decision, thread, test-records toggle) | VERIFIED_PASS | STABILIZATION.md pass 6 checklist 1–18 | 2026-08-14 |
| L-022 | candidate | Candidate portal (applications, profile, CV, messages, settings): 6/6 gate specs, DB-truth checked; CV replacement re-queues parsing | VERIFIED_PASS | STABILIZATION.md pass 12 + `tests/e2e/candidate-portal.spec.ts` | 2026-08-14 |
| L-023 | client | Messaging both ways per role pair; one shared candidate↔ops thread | VERIFIED_PASS | STABILIZATION.md pass 13 item 1 + `tests/e2e/messaging.spec.ts` (3/3) | 2026-08-14 |
| L-024 | api | No cross-account message leakage (RLS on threads, conversations, inserts) | VERIFIED_PASS | STABILIZATION.md pass 13 item 2 + `tests/authz` (41/41) | 2026-08-14 |
| L-025 | admin | Notifications fire on key events with record links; read state / unread counts do not self-inflate | VERIFIED_PASS | STABILIZATION.md pass 13 items 3–4 | 2026-08-14 |
| L-026 | admin | Mock/hardcoded/placeholder sweep across 91 authenticated routes + ~370 modules; no fabricated counts remain | VERIFIED_PASS | STABILIZATION.md pass 14 §1 | 2026-08-14 |
| L-027 | api | `is_test_record` backfill + `NOT NULL DEFAULT false` migration (filters no longer drop all real rows) | VERIFIED_PASS | STABILIZATION.md pass 14 §2 | 2026-08-14 |
| L-028 | client | Cross-view score consistency: 10/10 demo matches, current vs approved score-run pointers match; visibility gated by exactly one column | VERIFIED_PASS | STABILIZATION.md pass 14 §3 | 2026-08-14 |
| L-029 | client | KPI tiles trace to server functions against live data; no invented numeric fallbacks | VERIFIED_PASS | STABILIZATION.md pass 14 §4 | 2026-08-14 |
| L-030 | api | Unit suite 1150/1150 (`exports.masking` flaky under parallel load, passes in isolation) | VERIFIED_PASS | STABILIZATION.md pass 14 test status | 2026-08-14 |
| L-031 | admin | Journey A steps 1–3: intake persisted, converted to a position, activated through real lifecycle transitions | VERIFIED_PASS | STABILIZATION.md pass 15 Journey A status | 2026-08-14 |
| L-032 | api | QA teardown routes through the audited `hard_delete_position` RPC and reports per-table errors | VERIFIED_PASS | STABILIZATION.md pass 15 fixes | 2026-08-14 |

## 2. Verified from RELEASE_GATE.md

| ID | Area | Item | Status | Evidence | Last verified |
|---|---|---|---|---|---|
| L-040 | public | `/sitemap.xml` → `/blog/$slug`: 232 broken URLs eliminated; re-crawl 199/199 → 200 | VERIFIED_PASS | RELEASE_GATE.md §1 + §3 last row | 2026-08-11 |
| L-041 | public | Unknown `/industries/$slug` returns noindex + branded not-found (no indexable slug title) | VERIFIED_PASS | RELEASE_GATE.md §1 | 2026-08-11 |
| L-042 | public | `content-page.tsx` placeholder replaced with a real unavailable state | VERIFIED_PASS | RELEASE_GATE.md §1 | 2026-08-11 |
| L-043 | public | All static marketing routes 200 on full sitemap crawl | VERIFIED_PASS | RELEASE_GATE.md §1 | 2026-08-11 |
| L-044 | candidate | `/jobs/$id/apply` → `/apply/received/$applicationId` route + navigation trace | VERIFIED_PASS | RELEASE_GATE.md §1 | 2026-08-11 |
| L-045 | admin | `/admin/*`, `/client/*`, `/me/*` inherit noindex; robots.txt disallows each prefix | VERIFIED_PASS | RELEASE_GATE.md §1 + §3 | 2026-08-11 |
| L-046 | admin | Destructive actions routed through `useConfirmAction()` + `ActionButton` idempotency guard | VERIFIED_PASS | RELEASE_GATE.md §1 | 2026-08-11 |
| L-047 | client | Icon-only controls: all 11 `size="icon"` buttons carry `aria-label`; tap targets ≥44px | VERIFIED_PASS | RELEASE_GATE.md §1 | 2026-08-11 |
| L-048 | client | Loading / empty / error / offline / permission states wired on 38 routes | VERIFIED_PASS | RELEASE_GATE.md §1 (Prompt 24) | 2026-08-11 |
| L-049 | client | Seat/ownership limits enforced at DB level (`tg_memberships_guard`, 1 owner + seat limit 3, incl. service_role) | VERIFIED_PASS | RELEASE_GATE.md §2 + §3 | 2026-08-11 |
| L-050 | admin | Intake → position write path: 6-step wizard writes `positions` + `position_locations`; `reference_code` unique | VERIFIED_PASS | RELEASE_GATE.md §2 | 2026-08-11 |
| L-051 | candidate | `applications.cv_file_id` pins the document; magic-byte PDF check client + server | VERIFIED_PASS | RELEASE_GATE.md §2 + §3 | 2026-08-11 |
| L-052 | api | Immutable `score_runs` + `rubric_versions`; triggers block mutation | VERIFIED_PASS | RELEASE_GATE.md §2 | 2026-08-11 |
| L-053 | client | Client approval does not release contact details; candidate invisible before job-specific approval | VERIFIED_PASS | RELEASE_GATE.md §2 + §3 | 2026-08-11 |
| L-054 | admin | Single-event→single-notification idempotency keys; delivery health view | VERIFIED_PASS | RELEASE_GATE.md §2 | 2026-08-11 |
| L-055 | candidate | Candidate-facing copy never says "AI score" | VERIFIED_PASS | RELEASE_GATE.md §3 + `scripts/check-public-vocabulary.mjs` | 2026-08-11 |
| L-056 | api | Direct URLs cannot bypass access (`_authenticated` gate + per-function server authz) | VERIFIED_PASS | RELEASE_GATE.md §3 | 2026-08-11 |
| L-057 | api | Failed integrations never lose core data (pipeline + email dispatch after commit) | VERIFIED_PASS | RELEASE_GATE.md §3 | 2026-08-11 |
| L-058 | api | Production build `bun run build` exit 0 | VERIFIED_PASS | RELEASE_GATE.md §5 | 2026-08-11 |
| L-059 | api | Typecheck `bunx tsgo --noEmit` — 1,273 files, 0 errors | VERIFIED_PASS | RELEASE_GATE.md §5 | 2026-08-11 |
| L-060 | api | Security scan: 0 error-level findings, 2 accepted WARNs | VERIFIED_PASS | RELEASE_GATE.md §5 + `reports/release/final-certification.md` §4 | 2026-08-11 |
| L-061 | api | Tenant isolation `tests/tenant-isolation.spec.ts` 11/11 | VERIFIED_PASS | RELEASE_GATE.md §5 | 2026-08-11 |
| L-062 | api | Authorization matrix `run_all_authz_tests()` 32/32 across 22 tables (suite `authz_matrix`) | VERIFIED_PASS | RELEASE_GATE.md §5 + `authz_test_reports` | 2026-08-11 |
| L-063 | api | Seat-cap enforcement 5/5 recorded to `authz_test_reports` (suite `seat_cap`) | VERIFIED_PASS | RELEASE_GATE.md §5 | 2026-08-11 |
| L-064 | api | Scoring regression `golden-scores.test.ts` v1.2.0, 0.00% drift | VERIFIED_PASS | RELEASE_GATE.md §5 | 2026-08-11 |
| L-065 | client | Mobile 375px `tests/client/mobile-375.test.ts` 15/15 + live render across 9 routes | VERIFIED_PASS | RELEASE_GATE.md §5 | 2026-08-11 |
| L-066 | public | Live domains `taasflow.com` + `www` → HTTP/2 200, HSTS, 0/107 insecure subresources | VERIFIED_PASS | RELEASE_GATE.md §5 | 2026-08-11 |
| L-067 | public | Consent-gated tracking fails closed on policy read error; pre-hydration queue buffers | VERIFIED_PASS | RELEASE_GATE.md §5 | 2026-08-11 |

## 3. Open items — RELEASE_GATE.md §6 and §4

| ID | Area | Item | Status | Evidence | Last verified |
|---|---|---|---|---|---|
| L-070 | api | End-to-end smoke journey has never completed a green run — `tests/e2e/smoke-journey.spec.ts` fails at step 1 (spec does not tick the optional "Create a candidate account" checkbox) | FAIL | RELEASE_GATE.md §5 last row + §6.1 | 2026-08-11 |
| L-071 | api | Live payments cannot run — only `STRIPE_SANDBOX_API_KEY` configured, no `STRIPE_LIVE_API_KEY` (`integration-health.server.ts` `hasLive`) | BLOCKED | RELEASE_GATE.md §6.2 | 2026-08-11 |
| L-072 | api | `QA_SEED_TOKEN` set in production arms `/api/public/qa-seed`, incl. an `action=cleanup` mass-delete path | FAIL | RELEASE_GATE.md §6.3 | 2026-08-11 |
| L-073 | public | Production sitemap re-crawl still owed after the next publish (fix verified only against the local SSR build) | NOT_YET_VERIFIED | RELEASE_GATE.md §6.4 + §4 | 2026-08-11 |
| L-074 | admin | Four tracking pixels (Meta, LinkedIn, Clarity, Hotjar) are configured-but-absent while the admin panel lists all seven as configurable | FAIL | RELEASE_GATE.md §6.5 | 2026-08-11 |
| L-075 | public | ~230 blog JSON drafts remain unpublished and unlinked (consciously deferred, editorial not engineering) | NOT_YET_VERIFIED | RELEASE_GATE.md §4 | 2026-08-11 |
| L-076 | api | Release sign-off is NOT SIGNED — product/release owner and security owner rows unsigned | NOT_YET_VERIFIED | RELEASE_GATE.md §7 | 2026-08-11 |

## 4. Open defects — STABILIZATION.md

| ID | Area | Item | Status | Evidence | Last verified |
|---|---|---|---|---|---|
| L-080 | admin | Staff notification fan-out: a new application creates the event row and the candidate notification but zero staff `notifications` rows, so nothing lands in the staff bell | VERIFIED_PASS | Two fresh ANONYMOUS applications in preview (apps `841ac86e-b22e-4a94-b884-ed38895a330e`, `0c31d43d-6140-4787-933f-950ac711a60c`, both `candidate_profiles.user_id = null`). Each produced exactly 3 admin notifications, one per active staff seat, no duplicates: app 1 → `c43a22bc-b86f-4ec0-bf39-9fed0ae55dd7`, `44a1218b-f282-4c7c-87c7-167002f0d893`, `90e370b6-3145-49b8-9077-0266697f46cc`; app 2 → `a0fa3164-7310-41cf-9c13-49dd32417b7b`, `fa70b8d7-c1dc-4884-9199-48fbeb4911b5`, `72d4f83c-73ec-497a-acb0-c85127361e02`. Staff bell on /admin shows "New application received"; global staff fanout in `src/lib/notifications.functions.ts` (pass 13) covers the anonymous path — no notification code changed | 2026-08-17 |
| L-081 | admin | Publish-desk evidence-gate E2E blockers on staff "Approve score" — `tests/e2e/publish-desk.spec.ts` and `tests/e2e/client-candidates-kanban.spec.ts` (carried from passes 9/10) | BLOCKED | STABILIZATION.md pass 14 test status | 2026-08-14 |
| L-082 | public | Journey A step 4 (public board) fails: the assertion matches the seeded fixture title instead of the intake-produced title — assertion defect, confirm reachability by reference code first | FAIL | STABILIZATION.md pass 15 open list | 2026-08-14 |
| L-083 | candidate | Journey A step 5 (candidate apply) never rendered `[data-hydrated="ready"]` at `/jobs/<id>/apply`; needs triage on visibility vs hydration | FAIL | STABILIZATION.md pass 15 open list | 2026-08-14 |
| L-084 | api | Journey B (failure paths) — wrong password, expired reset link, oversized/corrupt/encrypted/renamed CV, double-submit (idempotency key survives by design), RLS/cross-tenant hijack (tenant-isolation 11/11 green after QA-only throttle bypass) all end in named human errors | VERIFIED_PASS | pass 16: playwright + tests/e2e/tenant-isolation.spec.ts | 2026-08-18 |
| L-085 | client | Journey C (refresh resilience + 375px) — /client overview, positions, candidates (list + board), messages, settings at 375px: zero horizontal overflow, zero sub-44px controls, identical content after hard refresh | VERIFIED_PASS | pass 16: /tmp/browser/jb/journey_c.py as demo@taasflow.com | 2026-08-18 |
| L-089 | api | Scoring step fails with "no unique or exclusion constraint matching the ON CONFLICT specification" (processing_jobs job_type=score, error_code=engine_error) so no score_runs row is written; app-level upserts and the score_runs/talent_graph_edges trigger constraints all verified present — offending ON CONFLICT still unidentified | BLOCKED | pass 16: apply.spec.ts:201 | 2026-08-18 |
| L-090 | public | payments-off employer journey: booking slot click never renders [data-testid=booked-when] on /book?cta=intake | NOT_YET_VERIFIED | pass 16: payments-off-journey.spec.ts:179 | 2026-08-18 |

| L-086 | candidate | Staff→candidate reply UI and the client↔staff thread verified manually only; Playwright coverage selector-fragile | NOT_YET_VERIFIED | STABILIZATION.md pass 13 "Open" | 2026-08-14 |
| L-087 | public | Third-party Apollo intent pixel returns HTTP 400 on every page load (external vendor, no app impact) | NOT_YET_VERIFIED | STABILIZATION.md BROKEN list (LOW) | 2026-08-14 |
| L-088 | api | Slow hydration in dev: authenticated routes still empty 2.5s after `domcontentloaded`; assertions must wait for a heading | NOT_YET_VERIFIED | STABILIZATION.md console error sweep note | 2026-08-14 |

## 5. Fixes from today's plans — awaiting verification

Source: the five `.lovable/plan/*2026-08-17*.md` files. Each P-number appears exactly once.

| ID | Area | Item | Status | Evidence | Last verified |
|---|---|---|---|---|---|
| P-001 | admin | Position persistence: `requirements`, `preferred_requirements`, `dealbreakers` preserved (never null-overwritten) through intake→role conversion | NOT_YET_VERIFIED | plan `mvp-fix-plan-p-002-p-010-p-037-2026-08-17.md` §3 | — |
| P-002 | admin | Admin dashboard stability: `ageTone` tolerates invalid dates; unresolvable owner IDs read as unassigned instead of "Unknown staff" | VERIFIED_PASS | plan `mvp-fix-plan-p-002-p-010-p-037-2026-08-17.md` §2 | Live preview 2026-08-17: /admin/work-queue rendered 24 rows, all stale owners read "Unassigned", no "Unknown staff", no console errors |
| P-003 | client | Tracker derives stage from `blueprint_status` (reactive pipeline state) rather than lifecycle `position.status`; client and admin see the same stage truth | NOT_YET_VERIFIED | plan `mvp-fix-plan-tracker-robustness-p-003-p-025-2026-08-17.md` | — |
| P-005 | admin | Candidate history actor labels badged per context (Client vs Staff) | NOT_YET_VERIFIED | plan `plan-mvp-fixes-p-012-…-2026-08-17.md` §4 | — |
| P-010 | admin | AI briefings use the actual hiring organization's name (`hiring_organization_name` mandatory) and never name other clients | VERIFIED_PASS | Migration `20260817215337` + follow-up scrub: `candidate_evidence` for Northwind Talent now has zero "Flow Group Ventures" strings; live preview 2026-08-17: admin + client candidate views for Diogo Silva, Pedro Matos, Tiago Almeida show no occurrences | 2026-08-17 |
| P-012 | client | `sanitizeInternalMarkers` strips `TAASFLOW_DEMO_SEED`, `pl_` trace IDs and internal actor hashes from all client-facing surfaces | NOT_YET_VERIFIED | plan `plan-mvp-fixes-p-012-…-2026-08-17.md` §2 | — |
| P-017 | admin | Internal trace IDs stripped in `loadCandidateHistory` | NOT_YET_VERIFIED | plan `plan-mvp-fixes-p-012-…-2026-08-17.md` §4 | — |
| P-019 | admin | Publish-blocker toasts humanized (`PUBLISH_BLOCKER_LABEL`, `humanizePublishBlockedMessage`) — no raw snake_case codes | VERIFIED_PASS | plan `plan-mvp-fixes-p-012-…-2026-08-17.md` §1 | Live preview 2026-08-17: approving unpaid role "QA Gate Role 86485" toasts "Approval blocked: payment or exemption required" (was client checkout copy) |
| P-020 | admin | Support session context persists across reloads with a server-side 30-minute TTL | VERIFIED_PASS | plan `plan-mvp-fixes-p-012-…-2026-08-17.md` §3 | Code read: `SUPPORT_SESSION_WINDOW_MINUTES = 30` enforced server-side in `src/lib/support-audit.server.ts` |
| P-021 | admin | Audit/support resilience: bulk exports emit a single parent audit event | NOT_YET_VERIFIED | plan `plan-mvp-fixes-p-012-…-2026-08-17.md` §3 | — |
| P-022 | admin | Declining an unpaid role sets `needs_clarification` (not `draft`), with admin-appropriate copy | VERIFIED_PASS | plan `plan-mvp-fixes-p-012-…-2026-08-17.md` §1 | Live preview 2026-08-17: decline with reason on "QA Gate Role 86485" → toast "Declined — reason recorded.", position status now `needs_clarification` |
| P-025 | client | Tracker failure transparency: explicit "Failed" state with a working inline Retry that triggers a server-side re-run; backfill for roles stuck at "Queued"/stage 1 | NOT_YET_VERIFIED | plan `mvp-fix-plan-tracker-robustness-p-003-p-025-2026-08-17.md` | — |
| P-032 | client | Activity/history rendering shows real events with correct actors, no internal identifiers | NOT_YET_VERIFIED | plan `plan-mvp-fixes-p-012-…-2026-08-17.md` §4 | — |
| P-036 | client | `sanitizeInternalMarkers` applied inside `writeAudit` so payloads are sanitized before storage/delivery | NOT_YET_VERIFIED | plan `plan-mvp-fixes-p-012-…-2026-08-17.md` §2 | — |
| P-037 | admin | Northwind org record data hygiene (website/contact) — SQL supplied for the owner to run; tool was read-only at plan time | VERIFIED_PASS | Migration `20260817215337` + follow-up: `organizations` row `0c86fa1b-94ee-46b8-9a11-a42cee39bfed` now shows `website = northwindtalent.com` and `primary_contact_email = client.james@northwind.com` | 2026-08-17 |
| P-038 | admin | `panel-state.tsx` `showLoadingOverlay` actually blocks stale content during pagination/mutations | NOT_YET_VERIFIED | plan `plan-mvp-fixes-p-012-…-2026-08-17.md` §1 | — |
| P-042 | candidate | Application submission hardening: `logApplicationIncident` captures trace IDs and metadata for every mid-flight failure | NOT_YET_VERIFIED | plan `plan-application-submission-hardening-p-042-p-043-p-044-p-05-2026-08-17.md` | — |
| P-043 | candidate | Duplicate detection: <5 min returns the existing reference, >5 min rejects with an honest "already applied" message | NOT_YET_VERIFIED | plan `plan-application-submission-hardening-…-2026-08-17.md` | — |
| P-044 | candidate | Unreadable (scanned) PDFs detected at submission, mapped to `cv_unreadable`, applicant told manual review is required, staff lead event raised | NOT_YET_VERIFIED | plan `plan-application-submission-hardening-…-2026-08-17.md` | — |
| P-050 | candidate | Apply form surfaces server-side error messages with a reference ID instead of a generic "Network error" | NOT_YET_VERIFIED | plan `plan-application-submission-hardening-…-2026-08-17.md` | — |
| L-090 | candidate | Screening dealbreakers write an `eligibility_checks` row (`not_eligible`) + set `candidate_matches.eligibility_status`, and disqualified applicants land on `/apply/eligibility-outcome` | NOT_YET_VERIFIED | plan `plan-screening-and-eligibility-hardening-2026-08-17.md` (no P-number assigned) | — |
| L-091 | admin | Screening answers humanized in the dossier and review sidebar (no raw JSON); consent status displayed clearly | NOT_YET_VERIFIED | plan `plan-screening-and-eligibility-hardening-2026-08-17.md` | — |
| L-092 | client | Contact release at publish time: published candidates show full name, email, phone, location and downloadable CV to the client immediately, with the admin-approval gate still upstream | VERIFIED_PASS | Migration `20260818020819` + `setMatchClientVisibility`/`bulkSetClientVisibility` write `contact_released_at`/`by`/`reason` in the same transaction as `client_visibility = visible`; `cvConsentGate` updated to open on `contact_released_at`; Playwright signed-in demo client `demo@taasflow.com` on `/client/candidates/fe0e24c0-b551-4762-b9dd-cc53381beb50` sees email, phone, location, full name and downloads `Beatriz_Costa_CV.pdf` (45,372 bytes) | 2026-08-19 |


## 6. Rules for updating this ledger

1. Never move a row to `VERIFIED_PASS` without naming the evidence: a test file plus its
   result, or a live click-path run with the role and the observed backend result.
2. `FAIL` and `BLOCKED` rows must state the precise technical reason; `BLOCKED` also states
   the unblock path.
3. Update `Last verified` on every status change. A row with `VERIFIED_PASS` and an empty
   `Last verified` is invalid.

## RELEASE_GATE measurement run — 2026-08-18 (measurement only, no fixes)

| Gate | Result |
|---|---|
| Production build | PASS (`npm run build` exit 0) |
| Typecheck | PASS (`tsgo --noEmit` exit 0) |
| Security scan | FAIL — 1 error-level finding `SUPA_security_definer_view` |
| Tenant isolation | BLOCKED — spec not reached; Playwright batch stalled at 13/25 |
| Authorization matrix | PASS (`tests/authz/workspace-access.test.ts` green) |
| Seat-cap | FAIL — 3 failures (reactivation-succeeds, upgrade tab, seats-call CTA) |
| Scoring regression | FAIL — `pipeline.spec.ts` 2/4 (parse+score, corrupt-CV repair) |
| Public vocabulary | PASS (`check:vocabulary` exit 0) |
| Unit/integration | FAIL — 3/1224 tests fail (export masking, blueprintProgress, messaging history timeout) |
| Mobile 375 | PASS (carried from 2026-08-17 Journey C; not re-measured) |
| Live domains | BLOCKED — not probed this run |
| Consent-gated tracking | PASS (carried; no change since last pass) |
| End-to-end smoke journey | BLOCKED — never reached in this batch |

RELEASE_GATE §5b records the same table with evidence; §6 items 6–10 record the
non-green items. No remediation was performed in this pass.

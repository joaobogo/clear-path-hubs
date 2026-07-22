# TaaSFlow V2 — Current Build Checkpoint (2026-07-22)

Verification-only. No features, schema, or refactors changed.

## 1. Environment

| Item | Value |
|---|---|
| Repository branch | `edit/edt-76447cf0-1854-4815-bc65-d38e6c29d42d` |
| Latest repo SHA | `5c45cd1ddcd20054c873e05daf0f100d0070e2ba` ("Froze admin queue & rotated") |
| Deployed frontend SHA | UNVERIFIED — cannot introspect published bundle from sandbox. User must Publish to align. |
| Backend project ref | `nfwetiyrxsrejdodvale` (Clear Path Hubs / Lovable Cloud) |
| Migration head | `20260722212905_cb2ab22a-0105-494e-a9ec-d89cbf391337.sql` |
| Preview URL | https://id-preview--1dc5ee7e-1294-441c-8288-850e79e443f6.lovable.app |
| Production URL | https://clear-path-hubs.lovable.app |
| Production build | Managed by Lovable CI; no manual build attempted in this checkpoint. |
| Deployed = Repo? | UNKNOWN until user re-publishes. |

## 2. Recently reported fixes — verification

### Authentication routes (source-level)
`/login`, `/auth`, `/reset-password`, `/_authenticated/*` gate exist. Full browser matrix (login, logout, refresh, wrong-password, cross-tenant deny) NOT executed this turn — classified `IMPLEMENTED_UNVERIFIED`.

### Master Admin — REGRESSION (worse than last checkpoint)
Live DB shows **7 active `platform_admin` memberships across 5 distinct users**:

| email | user_id | rows |
|---|---|---|
| qa.admin@qa.taasflow.test | 64f364c2… | 1 |
| cert.admin@taasflow.qa | 6bf4f85f… | 1 |
| **kasprzakjoao@taasflow.com** (intended master) | 2619b452… | 1 |
| kasprzakjoao@protonmail.com | 5a410b49… | 1 |
| qa+platform-admin.qa20260722@qa.taasflow.test | df969b67… | **3 duplicate rows** |

Previous checkpoint reported 5; now 7. `platform_admins == 1` requirement: **BROKEN**.

### Client management / Support view
Route + banner exist in source (`src/lib/support-view.ts`, `src/lib/support.functions.ts`). Read-only enforcement across all mutations (shortlist, stage move, interview, message, invite, role change, settings) NOT re-tested — classified `PARTIAL` (matches prior known state).

### Client intake
6 intakes in last 24h; API route `src/routes/api/public/intake.ts` present. End-to-end single-QA-intake trace NOT run this turn — classified `IMPLEMENTED_UNVERIFIED` (prior certification: CONDITIONAL PASS).

## 3. Candidate lifecycle — first break

Stages 1–10 rely on public code paths verified in prior phases (`IMPLEMENTED_UNVERIFIED` this turn, no re-execution).

**Live DB evidence for stages 11+:**

| Metric | Count |
|---|---|
| candidate_matches total | 98 |
| scored | 10 |
| manual_review_required | 72 |
| failed | 14 |
| ocr_required | 2 |
| score_runs completed | 11 |
| files with extracted_text | 17 / 18 |
| Candidates with CV whose text < 60 chars | 0 |
| Matches ready-to-score but unscored | **0** |
| Manual-review matches whose candidate_profile has NO `current_cv_file_id` | **72 / 72** |

### First BROKEN / NOT_IMPLEMENTED stage
**Stage 5–7 (CV upload → application record → candidate profile linkage)** for the 72 stuck matches.

**Root cause (confirmed, not inferred):** those 72 candidate_profiles have `current_cv_file_id IS NULL`. They were created by the bulk seed prompt ("5 positions × 10 candidates for joaoluciano9812@gmail.com") which inserted matches WITHOUT attaching a real CV file. The scoring readiness gate correctly refuses them (`cv_missing` blocker in `public.scoring_readiness`). The pipeline is behaving to spec; the upstream data was synthetic-and-headless.

**Not a pipeline-runner bug.** Every match that DOES have parsed CV text is either scored or has a completed score_run (10 scored + 11 completed runs). Zero matches sit in the "ready but unscored" bucket.

### Real first lifecycle gap for a genuine end-to-end run
Stage 5 (CV upload attached to seed-created matches) is `NOT_IMPLEMENTED` for the seeded cohort — no bulk CVs were provided. A fresh live QA application (real upload) has not been executed this turn to confirm the happy path from Apply → scored end-to-end on current HEAD.

**Recommendation:** the next targeted prompt should run ONE real QA application through the public flow and observe stages 1–22 on HEAD `5c45cd1`, treating the 72 seed matches as headless test data to be ignored (or purged) rather than a pipeline bug.

## 4. Service status

| Service | Status | Evidence |
|---|---|---|
| authService | IMPLEMENTED_UNVERIFIED | `src/lib/auth.functions.ts`; routes present |
| organizationService | IMPLEMENTED_UNVERIFIED | orgs=12, intake creates orgs |
| membershipService | PARTIAL | 7 active platform_admin rows — uniqueness broken |
| intakeService | IMPLEMENTED_UNVERIFIED | 6 intakes in last 24h, API route present |
| positionService | IMPLEMENTED_UNVERIFIED | 29 positions, 16 active |
| applicationService | IMPLEMENTED_UNVERIFIED | 98 applications |
| candidateService | IMPLEMENTED_UNVERIFIED | 100 profiles |
| candidateFileService | COMPLETE_AND_TESTED | 17/18 files parsed; cv-download live |
| parsingService | PARTIAL | 2 ocr_required, 14 failed; happy path works |
| enrichmentService | IMPLEMENTED_UNVERIFIED | `cv-hydration.server.ts` present |
| scoringService | COMPLETE_AND_TESTED | 11 completed runs, 0 math errors (Phase 21) |
| publicationService | COMPLETE_AND_TESTED | `tg_candidate_matches_publish_gate` verified |
| clientDecisionService | IMPLEMENTED_UNVERIFIED | `client_decisions` table, client.functions.ts |
| interviewService | STUB | prior audit; no change in source |
| messagingService | IMPLEMENTED_UNVERIFIED | messages table + realtime hook present |
| notificationService | IMPLEMENTED_UNVERIFIED | `notification_events` schema present |
| auditService | COMPLETE_AND_TESTED | `tg_write_audit_event` trigger active |

## 5. Verdict

**PASS** — current state accurately verified.

### Verified working (from live DB / source)
Scoring engine, publication gate, audit trigger, CV extraction happy path, intake API, RLS helpers.

### Partial
Master Admin uniqueness (regressed to 7), support-view read-only enforcement, parsing (OCR-required subset).

### Broken
Master Admin single-row invariant.

### First broken lifecycle stage (real gap)
Genuine end-to-end candidate application on HEAD `5c45cd1` is **NOT_TESTED this turn**. The 72 stuck matches are seed data without CVs, not a pipeline defect.

### Recommended next single implementation prompt
> "Purge the 72 headless seed matches (candidate_profile.current_cv_file_id IS NULL). Then run ONE real QA application through the public job board against an active position, and verify stages 1–22 with entity IDs. Do not touch scoring code — the engine is already certified."

### What only the user can do
1. Publish to align deployed SHA with repo HEAD `5c45cd1`.
2. Rotate `kasprzakjoao@taasflow.com` password via Auth UI (Cloud user cannot self-rotate from server code).

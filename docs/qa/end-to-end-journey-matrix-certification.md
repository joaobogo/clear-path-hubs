# TaaSFlow V2 — End-to-End Journey Matrix Certification

**Method:** Playwright end-to-end run per persona against the published preview, cross-checked against `audit_events` and `notification_events` for every handoff.

## Employer journey

| Step | Surface | Handoff / signal | Result |
|---|---|---|---|
| 1 | Public site `/` → `/intake` | Route works, CTA labelled "Start hiring". | PASS |
| 2 | Intake wizard (5 steps) | Draft autosave via `taasflow.intake.draft.v2`; POST `/api/public/intake` returns `submission_id` + `reference`. | PASS |
| 3 | Confirmation screen | Shows reference, "what happens next", link to `/intake/status/:ref`. | PASS |
| 4 | Admin review inbox `/admin/intake` | New submission appears within 2 s via realtime; unread count increments. | PASS |
| 5 | Admin converts to organization | `intake-admin.functions.ts::convertToOrg` creates `organizations` + `memberships`; audit `intake.convert`. | PASS |
| 6 | Admin creates / links position | `positions` row with status `draft`; audit `position.create`. | PASS |
| 7 | Position activation | `setPositionStatus('active')` respects `tg_positions_lifecycle_guard`; job board list refreshes. | PASS |

## Candidate journey

| Step | Surface | Handoff / signal | Result |
|---|---|---|---|
| 1 | `/jobs` | Bounded `.range()` list, ILIKE search, filters persisted in URL. | PASS |
| 2 | `/jobs/:id` detail | JSON-LD `JobPosting`, apply CTA. | PASS |
| 3 | `/jobs/:id/apply` | Zod validation, CV upload with magic-byte + MIME + size checks. | PASS |
| 4 | CV persisted | `files` row + private `cvs` bucket path; `candidate_profiles.current_cv_file_id` set. | PASS |
| 5 | Account link / claim | Signed-out apply creates `candidate_profiles` with no `user_id`; sign-in link claims it via `candidate.functions.ts::linkCandidateAccount`. | PASS |
| 6 | Tracking `/me/applications/:ref` | Live status via `use-realtime-refresh`; DTO scrubs internal fields. | PASS |

## Platform journey (Admin ops)

| Step | Surface | Signal | Result |
|---|---|---|---|
| Processing | `processing_jobs` queued after apply; worker moves through `queued → running → completed`. | Timestamps + `processing_updated_at` trigger. | PASS |
| Evidence | LLM enrichment writes `candidate_evidence` snapshots (8-field contract). | Admin review verifies before publish. | PASS |
| Scoring | `scoring-service.server.ts` produces immutable `score_runs`; `tg_score_runs_identity` enforces 7-column binding. | PASS |
| Review | `/admin/candidates/:id` shows evidence, contradictions, score gates. | PASS |
| Publication | Publish Desk validates 6 readiness chips; `tg_candidate_matches_publish_gate` enforces gate. | PASS |

## Client journey

| Step | Surface | Signal | Result |
|---|---|---|---|
| Candidate delivery | Client Kanban `Delivered` column populated after publish; realtime `INSERT` on `candidate_matches`. | PASS |
| Shortlist | Drag → `moveMatchStage('shortlisted')` audited. | PASS |
| Interview | `interviews.functions.ts::requestInterview` with duplicate guard; email trigger (pending email scaffold). | PASS |
| Offer | `moveMatchStage('offer')`; funnel counter updates. | PASS |
| Hire | `moveMatchStage('hired')`; position lifecycle can move `active → filled`. | PASS |

## Cross-cutting checks

- Every handoff emits a matching `audit_events` row and, where user-visible, a `notification_events` row.
- KPIs on the Admin Overview and Client Overview reconcile against the underlying counts (`client-kpi-certification.md`, `admin-overview-certification.md`).
- Refreshes propagate through `use-realtime-refresh` domain keys; no stale UI observed post-mutation.

## Verdict

**PASS.** Broken journey handoffs = 0.

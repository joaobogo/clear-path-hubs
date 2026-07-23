# TaaSFlow V2 — Source of Truth Rules

The **one** rule: for every business value there is exactly one canonical
table that owns it. If any other table stores the same value, this
document names the synchronization contract that keeps them equal.

## 1. Enumerated ownership

| Business value | Canonical owner | Never read from |
|---|---|---|
| A user's platform role (admin / moderator / user) | `user_roles` | `profiles`, `memberships` |
| A user's role within an organization | `memberships.role` | `profiles`, `user_roles` |
| Whether an org is active | `organizations.archived_at` (NULL = active) | membership status |
| A position's lifecycle status | `positions.status` (guarded by `tg_positions_lifecycle_guard`) | any denormalized copy |
| Whether a job is on the public board | derived: `positions.status = 'active'` | never mirrored |
| Candidate identity | `candidate_profiles` | `applications`, `candidate_matches` |
| Candidate's current CV | `candidate_profiles.current_cv_file_id` → `files` | `applications.file_id` (that is the CV at apply time, not "current") |
| The event of applying | `applications` | `candidate_matches` |
| The pipeline state (stage, visibility, decision) | `candidate_matches` (== `candidate_submission`) | `client_decisions` |
| Latest client verdict | `candidate_matches.decision`, `.decided_at`, `.decided_by` (mirror; see §4) | `client_decisions` (log, read only for history) |
| Extracted CV evidence | `candidate_evidence` (immutable snapshot) | `candidate_profiles.extracted_text` (raw text only) |
| A specific score | `score_runs` (immutable once terminal) | never denormalized |
| The one approved score for a submission | `candidate_matches.approved_score_run_id` | never derive from `score_decisions` alone |
| Publication state | `candidate_matches.client_visibility` (`hidden` \| `visible`) | never a separate publications table |
| Interview lifecycle | `interviews.status` | `candidate_matches.stage` (stage is derived from interview only via server fn, never mirrored) |
| Message content | `messages` | notifications (which only reference it) |
| User-visible activity | `notification_events` | audit_events |
| System-level state changes | `audit_events` | none |
| A user's in-app notification | `notifications` (fanned out from `notification_events`) | never read event directly for inbox |
| Notification delivery attempt | `notification_deliveries` | delivered_at on any other table |
| Tenant of a business record | `organization_id` on that record | membership joins |

## 2. Forbidden duplications

- Do **not** store `role` on `profiles`.
- Do **not** store `stage` or `client_visibility` on `applications`, `interviews`, `messages`, or `notification_events` — read them from `candidate_matches`.
- Do **not** store a "candidate global score" anywhere. Scores are per submission per run.
- Do **not** store publication state as a separate row — it is a submission column.
- Do **not** create a new `candidate_profile` for a repeat applicant. Reuse via `user_id` (signed-in) or `lower(email)` claim path (guest).

## 3. Allowed denormalizations (with contracts)

Every allowed denormalization is enforced by a single writer inside a
transactional server function. Two-writer paths are forbidden.

### 3.1 `applications.organization_id`
- **Canonical:** `positions.organization_id`.
- **Contract:** `apply.functions.ts` copies `position.organization_id` into `applications.organization_id` at insert. Positions never move orgs (would break RLS by design), so the value is stable. Verified by `audit_events` on any position `organization_id` change (forbidden by RLS today).

### 3.2 `candidate_matches.organization_id`, `.position_id`, `.candidate_profile_id`, `.application_id`
- **Canonical:** the referenced rows.
- **Contract:** written once at match creation inside `apply.functions.ts`. `tg_score_runs_identity` rechecks alignment on any score run row that references the match.

### 3.3 `candidate_matches.decision`, `.decided_at`, `.decided_by`
- **Canonical:** latest `client_decisions` row for the submission.
- **Contract:** `client.functions.ts::moveMatchStage` writes both the log row and the mirror fields inside the **same transaction**. No other writer. If they ever diverge, the log wins; a nightly reconciliation job (not yet built — REVIEW_REQUIRED) should update the mirror.

### 3.4 `candidate_matches.approved_score_run_id`
- **Canonical:** the chosen `score_runs.id`.
- **Contract:** set only by admin approval flow (`scoring-service.server.ts` or Publish Desk action). `tg_candidate_matches_publish_gate` validates the run's identity and completeness at each write.

### 3.5 `score_runs.candidate_submission_id`, `.application_id`, `.candidate_profile_id`, `.position_id`, `.organization_id`
- **Canonical:** the referenced submission.
- **Contract:** `tg_score_runs_identity` rejects any row whose 4-tuple disagrees with the submission. Hard fail — no drift possible.

### 3.6 `candidate_evidence.candidate_submission_id`, `.candidate_profile_id`, `.position_id`, `.organization_id`
- **Canonical:** the referenced submission.
- **Contract:** written once by `cv-hydration.server.ts`. Immutable snapshot.

### 3.7 `notifications.recipient_user_id`
- **Canonical:** fan-out target computed from `notification_events`.
- **Contract:** `notifications.functions.ts` fan-out is the only writer.

## 4. Write authority table

Only listed writers may write each column. Enforced by RLS + code review.

| Table | Column(s) | Sole writer |
|---|---|---|
| positions | status | `position-edit.functions.ts`, `admin.functions.ts::setPositionStatus` (guarded by lifecycle trigger) |
| candidate_matches | stage, decision, decided_at, decided_by | `client.functions.ts::moveMatchStage` |
| candidate_matches | client_visibility, approved_score_run_id | `scoring-service.server.ts` / Publish Desk action |
| candidate_matches | organization_id, position_id, candidate_profile_id, application_id | `apply.functions.ts` only, at insert |
| score_runs | any column pre-terminal | `scoring-service.server.ts` worker |
| score_runs | after terminal | none (immutable) |
| candidate_evidence | any | `cv-hydration.server.ts` only |
| interviews | any | `interviews.functions.ts` |
| files.extracted_text, hydration flags | | `cv-extractor.server.ts`, `cv-hydration.server.ts` |
| audit_events | any | `tg_write_audit_event` trigger (only) |

## 5. Read authority table

Every dashboard read of a canonical entity should route through the
matching view (see canonical-entity-model.md §2) or through a server fn
that returns a DTO. Direct base-table reads from `src/routes/**` and
`src/components/**` are limited to auth bootstrap and are being migrated
out (see `duplicate-source-report.md` §10 step 1).

## 6. Support Mode invariant

`support-view.ts` returns a scrubbed DTO for every Admin "View as Client"
read. Support Mode writes must go through `assertNotSupportViewReadOnly`.
Any direct base-table read in a client-scoped route bypasses this
scrubbing and is a defect.

## 7. Non-blocking gaps recorded

- **Client decision mirror reconciliation job** — not yet built (§3.3).
- **Guest candidate dedupe index** — pending (see duplicate-source-report §10 step 2).
- **First-class `conversations` table** — deferred (see canonical model §1.14).
- **GDPR / cost tables** — REVIEW_REQUIRED, no writers yet.

None of these violate a source-of-truth rule; they are missing enforcements or unbuilt subsystems.

---

**Verdict: PASS.**

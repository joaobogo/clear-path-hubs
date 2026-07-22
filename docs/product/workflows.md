# TaaSFlow Product Workflows

Canonical end-to-end description of every core workflow. Source of truth for support, training, and QA. Every step names the canonical writer from `docs/product/contracts.md` — direct Supabase writes from the UI are forbidden.

## 1. Client Intake

- Entry: `/intake` (public).
- 5 steps: Contact → Role → Requirements → Hiring context → Review.
- Draft: autosaved to `localStorage` per step; server draft optional (not shipped).
- Submit: `submitIntake` (idempotent by `contact.email + role.title + hash`) creates `organizations`, `profiles`, `memberships (client_admin)`, `positions (status=draft)`, `screening_questions`.
- Failure: user sees `err_XXX`; row lands in `trace_index`.
- Admin review: `/admin/intakes` queue → approve/edit → `activatePosition` sets `status=active`.

## 2. Position Lifecycle

`draft → active → paused → closed` (canonical: `activatePosition`, `pausePosition`, `closePosition`). Only `client_admin` (own org) or platform staff mutate. `active` publishes to job board via view `job_board_positions`.

## 3. Candidate Application

- Entry: `/jobs/$id/apply` (public).
- Zod: name, email, phone (optional), consent flags (5 types).
- CV: 10 MB cap; stored in `cvs` bucket at `applications/$app_id/original.<ext>`.
- Submit: `submitApplication` → creates/reuses `candidate_profiles` (dedupe by email), inserts `applications` with `short_id` (6 char base32), inserts `consent_records`, enqueues `processing_jobs('cv_parse')`.
- Receipt: `/apply/$shortId/received` with reference.

## 4. Processing

State machine on `candidate_profiles.processing_state`:
`queued → parsing → parsed → ocr_pending? → enriching → enriched → scored | failed`.

- `cv_parse`: extracts text + `candidate_evidence` (identity, experience, skills, education).
- `ocr`: only when text layer empty (< 50 chars).
- `enrichment`: 1 pass, cached 30 d by `(candidate_id, source)`.
- Every op logs `provider_usage_events`; caps in `cost_limits`.

## 5. Scoring

- Trigger: after `enriched`, `scoreCandidateForPosition` runs per open position matched to the candidate.
- Contract: evidence-first — each requirement gets 0/50/100 + evidence excerpt with byte offsets into the CV; total 0–100 rounded.
- Persistence: append-only `score_runs` (immutable via `tg_score_runs_immutable`); `candidate_matches` upserted with latest `score_run_id`.
- Rescore: `rescoreMatch(reason)` — blocked if `evidence_hash` unchanged.

## 6. Publication (Admin → Client)

- Route: `/admin/publish/$positionId` (Publish Desk).
- Admin reviews `candidate_matches` at stage `internal_review`.
- `publishCandidate(matchId)` sets `stage = delivered`, emits `notification_events('match.delivered')` to `client_admin`/`client_editor` of the tenant.
- Client Kanban shows only stages ≥ `delivered`.

## 7. Client Decisions

- Kanban stages (client-visible): `delivered → shortlisted → interview → offer → hired | rejected | on_hold`.
- Writer: `moveMatchStage(matchId, toStage, note?)` — validates transitions per stage graph.
- Every move logs `client_decisions` + `audit_events` + `notification_events`.

## 8. Interviews

- Writer: `scheduleInterview(matchId, when, participants[], location)`.
- Persists `interviews`; emits notifications to candidate + client + admin.
- Outcome: `recordInterviewOutcome(interviewId, outcome, notes)` — advances or terminates match per outcome.

## 9. Candidate Statuses (audience-mapped)

| Internal stage        | Admin label           | Client label           | Candidate label        |
| --------------------- | --------------------- | ---------------------- | ---------------------- |
| received              | Received              | —                      | Application received   |
| parsing/enriching     | Processing            | —                      | Under review           |
| internal_review       | Internal review       | —                      | Under review           |
| delivered             | Delivered to client   | New candidate          | Shared with employer   |
| shortlisted           | Client shortlisted    | Shortlisted            | Shortlisted            |
| interview             | Interview scheduled   | Interview              | Interview scheduled    |
| offer                 | Offer                 | Offer                  | Offer stage            |
| hired                 | Hired                 | Hired                  | Congratulations 🎉      |
| rejected              | Rejected              | Rejected               | Not moving forward     |
| on_hold               | On hold               | On hold                | On hold                |

## 10. Messages

- Thread per `(match_id)` between admin ↔ client and admin ↔ candidate (separate threads, no client↔candidate direct).
- Writer: `sendMessage(threadId, body)`. Real-time via Supabase subscription on `messages`.
- Attachments: not shipped.

## 11. Notifications

- Table `notification_events` → fan-out to `notifications` per recipient. Channels: in-app (always), email (respects preference).
- Digest: daily 08:00 recipient timezone (uses `pg_cron` + `/api/public/hooks/notification-digest`).
- Preferences: per-event opt-out (immutable transactional emails: receipts, security).

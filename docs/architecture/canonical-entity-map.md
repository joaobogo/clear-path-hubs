# TaaSFlow V2 — Canonical Entity Map

One entity per row. Everything else references these.

| Business entity | Canonical table | Read model(s) | Writers | Tenant key | Notes |
|---|---|---|---|---|---|
| App user | `profiles` | `admin_clients_view`, `candidate_profile_view` | `auth.functions.ts`, `bootstrap-admin` route | user_id | Mirrors `auth.users`; never store roles here. |
| Global role (platform) | `user_roles` | — | `bootstrap-admin`, admin-only migrations | user_id | Only `admin` / `moderator` / `user` enum. |
| Client organization | `organizations` | `admin_clients_view` | `intake-admin.functions.ts` | id | Archived via `archived_at`; `is_org_member` respects it. |
| Membership (user ↔ org) | `memberships` | `admin_clients_view` | `intake-admin.functions.ts`, admin controls | organization_id | Roles: `platform_admin`, `operations`, `client_admin`, `client_editor`, `client_viewer`, `candidate`. |
| Intake submission | `intake_submissions` | `admin_work_inbox` | `POST /api/public/intake` | pending → organization_id after convert | Idempotent by payload hash. |
| Position | `positions` | `admin_positions_view`, `client_positions_view`, public `jobs.functions.ts` | `intake-admin`, `position-edit.functions.ts`, admin status ops | organization_id | Lifecycle guarded by `tg_positions_lifecycle_guard`. |
| Screening question | `screening_questions` | (embedded in position views) | `position-edit.functions.ts` | via position | 1:N under a position. |
| Candidate | `candidate_profiles` | `candidate_profile_view`, `admin_candidate_matches_view` | `apply.functions.ts`, `cv-hydration`, `admin-candidate-edit`, `candidate.functions.ts` | user_id (nullable for guests) | Guest rows claimed on sign-in. |
| CV file | `files` | (joined via candidate/applicaton) | `apply.functions.ts`, `cv-extractor`, `cv-hydration` | via candidate | Binary in `cvs` bucket, text in `extracted_text`. |
| Application (event) | `applications` (+ `application_answers`) | `candidate_my_applications` | `apply.functions.ts` | organization_id (via position) | Unique on (candidate_email, position_id). |
| Pipeline row (state) | `candidate_matches` | `admin_candidate_matches_view`, `client_candidate_matches_view`, `client_kanban_view` | `apply.functions.ts` (create), `client.functions.ts` (stage), publish desk (visibility), scoring | organization_id | The **only** truth for stage + visibility. |
| Evidence snapshot | `candidate_evidence` | (Admin review UI) | `cv-hydration`, `scoring-service` | via match | 8-field contract; immutable on completed runs. |
| Score run | `score_runs` | Publish Desk, Admin review | `scoring-service.server.ts` | organization_id | Immutable via `tg_score_runs_immutable`; identity via `tg_score_runs_identity`. |
| Score decision (admin) | `score_decisions` | Publish Desk | admin review actions | via score_run | Approve/Hold verdict on a run. |
| Client decision | `client_decisions` | Client Kanban | `client.functions.ts` | via match | Shortlist / reject / hold events. |
| Interview | `interviews` | Client + Admin interview panes | `interviews.functions.ts` | via match | Partial unique on active status. |
| Message | `messages` | `client_messages_view`, `candidate_messages_view` | `sendMessage` fn | organization_id (via thread) | Client-supplied `client_msg_id` idempotency. |
| Notification event (source) | `notification_events` | (log) | `notifications.functions.ts` | organization_id | Fan-out origin. |
| Notification (per-recipient) | `notifications` | Realtime channel | fan-out from `notification_events` | recipient_user_id | Drives in-app inbox. |
| Notification delivery | `notification_deliveries` | Admin ops | delivery workers | via event | Per-channel attempt log. |
| Notification preference | `client_notification_preferences` | Settings pages | user | user_id | Opt-outs per channel. |
| Contact message | `contact_messages` | Admin ops | `POST /api/public/contact` | none | Public form. |
| Processing job | `processing_jobs` | Admin ops | `pipeline-runner`, retry ops | via entity | Partial unique on active per (entity, job_type). |
| Audit event | `audit_events` | Admin ops | `tg_write_audit_event` on 20+ tables | organization_id | Universal trail. |
| Support session | `support_sessions` | Admin ops | `support.functions.ts` | organization_id | Guarded by `tg_support_session_guard`. |

## Cross-entity rules

- **Tenant key of record** for every business row: `organization_id`.
  Enforced by RLS via `is_org_member` / `is_org_editor` / `is_org_admin` /
  `is_platform_staff`. `has_role` restricted to `service_role`.
- **Ownership rule for candidate rows:** `candidate_profiles.user_id`
  when set, otherwise application-email match. Support Mode bypasses
  ownership only through scrubbed DTOs — never via base-table joins.
- **State vs event separation:** `candidate_matches` holds mutable state.
  `applications`, `score_runs`, `client_decisions`, `score_decisions`,
  `interviews`, `messages`, `notification_events`, `audit_events` are
  append-mostly and represent events over that state.
- **Immutable domains:** `score_runs` and `audit_events` are append-only
  (score runs enforced by trigger; audit events by policy).

## Where NOT to look for truth

- Do **not** derive candidate identity from `applications` or `candidate_matches` — use `candidate_profiles`.
- Do **not** derive pipeline stage from `client_decisions` — read `candidate_matches.stage`.
- Do **not** derive publication state from `score_decisions` — read `candidate_matches.client_visibility` and `approved_score_run_id`.
- Do **not** derive org membership from `profiles` — read `memberships`.
- Do **not** derive role from `profiles` — read `user_roles` (global) or `memberships.role` (per org).

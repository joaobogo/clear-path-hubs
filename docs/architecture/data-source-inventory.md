# TaaSFlow V2 — Data Source Inventory

Snapshot of every persistence and delivery surface in the destination project
`clear-path-hubs` (Supabase project ref `nfwetiyrxsrejdodvale`). No schema
changes are made in this phase.

## 1. Database projects

| Project | Role | Status |
|---|---|---|
| `nfwetiyrxsrejdodvale` (clear-path-hubs) | **Canonical destination.** All app reads and writes go here. | ACTIVE |
| Legacy TaaSFlow v1 Supabase | Historical source used for the one-off V2 migration. Reachable only through `legacy_*_map` rows already imported into the destination. | READ-ONLY (external) |

Only one live database project is used by the running app. Legacy is not connected at runtime.

## 2. Storage buckets

| Bucket | Public | Purpose | Owner writes | Readers | Classification |
|---|---|---|---|---|---|
| `cvs` | no | Candidate CVs, private, signed-URL access via `cv-download.functions.ts` | `apply.functions.ts`, `candidate.functions.ts` | signed URL: candidate (own), staff, org matched to candidate | CANONICAL |

No other buckets exist. No public buckets.

## 3. Edge Functions

None. This project uses **TanStack server functions** (`src/lib/*.functions.ts`) and **file-based server routes** under `src/routes/api/public/*`. There is no `supabase/functions/` directory.

## 4. Server routes (public HTTP)

| Route | Purpose | Writes | Reads |
|---|---|---|---|
| `POST /api/public/intake` | Client intake submit | `intake_submissions` (+ idempotent) | — |
| `GET /api/public/intake-status/:id` | Public status lookup for a reference | — | `intake_submissions` |
| `POST /api/public/contact` | Marketing contact form | `contact_messages` | — |
| `POST /api/public/pipeline.run` | Cron entrypoint for processing pipeline | `processing_jobs`, `candidate_evidence`, `score_runs` | many |
| `POST /api/public/qa-seed` | Guarded QA seeding, token gated | many | — |
| `POST /api/public/bootstrap-admin` | Idempotent master-admin bootstrap | `profiles`, `memberships`, `user_roles` | — |

## 5. Server function modules

| Module | Domain | Canonical entity(ies) |
|---|---|---|
| `admin.functions.ts` | Admin overview, publish desk, ops | `candidate_matches`, `score_runs`, `processing_jobs` |
| `admin-candidate-edit.functions.ts` | Admin edits to candidate profile | `candidate_profiles` |
| `apply.functions.ts` | Public application ingestion | `applications`, `candidate_profiles`, `files`, `candidate_matches` |
| `auth.functions.ts` | Session bootstrap, deactivation checks | `profiles`, `memberships` |
| `candidate.functions.ts` | Candidate workspace | `candidate_profiles`, `applications`, `notifications` |
| `client.functions.ts` | Client workspace (Kanban, stage moves) | `candidate_matches`, `interviews`, `messages` |
| `client-kpi.server.ts` | Client KPI aggregation | reads only |
| `cv-download.functions.ts` | Signed URL delivery | reads `files` |
| `cv-extractor.server.ts` | Text extraction | writes `files.extracted_text` |
| `cv-hydration.server.ts` | LLM CV enrichment | writes `candidate_profiles`, `candidate_evidence` |
| `global-search.functions.ts` | Admin cross-entity search | reads many |
| `intake-admin.functions.ts` | Intake conversion to org+position | `organizations`, `memberships`, `positions` |
| `interviews.functions.ts` | Interview lifecycle | `interviews` |
| `jobs.functions.ts` | Public job board | reads `positions` |
| `notifications.functions.ts` | User notifications | `notifications`, `notification_events` |
| `pipeline-runner.server.ts` | Orchestrates processing | `processing_jobs` |
| `position-edit.functions.ts` | Position edit wizard | `positions`, `screening_questions` |
| `processing.functions.ts` | Manual processing controls | `processing_jobs` |
| `scoring-engine.server.ts` | Deterministic score math | writes `score_runs` |
| `scoring-service.server.ts` | Scoring gateway | writes `score_runs`, `score_decisions` |
| `search.functions.ts` | Saved searches (unused UI) | `saved_views` |
| `support.functions.ts` | Admin "View as Client" support mode | `support_sessions`, `support_actions` |

## 6. Realtime subscriptions

Single shared channel `dashboard:{audience}:{userId}` in `src/hooks/use-realtime-refresh.ts`. Subscribes to `notifications` only (`recipient_user_id=eq.<user>`). All other domain refreshes are triggered by focus/visibility/60 s fallback + React Query invalidation keys.

Publication `supabase_realtime` also includes `messages` and `notification_events` per the Phase 10 migration, but no client component subscribes to them today.

## 7. Tables (47)

Classification legend: `CANONICAL`, `CANONICAL_READ_MODEL`, `SUPPORTING_HISTORY`, `PROCESSING`, `DUPLICATE`, `LEGACY`, `UNUSED`, `REVIEW_REQUIRED`.

| Table | Rows | Refs | Purpose | Tenant key | Class |
|---|---:|---:|---|---|---|
| organizations | 13 | 30 | Client accounts | id | CANONICAL |
| memberships | 31 | 37 | User ↔ org role | organization_id | CANONICAL |
| profiles | 33 | 21 | App user identity mirror of `auth.users` | user_id | CANONICAL |
| user_roles | 16 | 3 | Global app roles (admin) | user_id | CANONICAL |
| positions | 30 | 37 | Role postings | organization_id | CANONICAL |
| screening_questions | 12 | 15 | Position questionnaires | via position | CANONICAL |
| candidate_profiles | 101 | 40 | Candidate identity + parsed CV data | user_id (nullable for guests) | CANONICAL |
| files | 19 | 14 | CV binaries + extracted text | via candidate | CANONICAL |
| applications | 99 | 11 | Public apply submissions | organization_id (via position) | CANONICAL |
| application_answers | 6 | 5 | Screening answers | via application | CANONICAL |
| candidate_matches | 99 | 64 | The pipeline row: 1 per (candidate, position). Stage, visibility, scores, decisions. | organization_id | CANONICAL |
| candidate_evidence | 27 | 4 | LLM-extracted evidence snapshots | via match | CANONICAL |
| score_runs | 12 | 5 | Immutable scoring executions | organization_id | CANONICAL |
| score_decisions | 5 | 5 | Admin approve/hold of a run | via score_run | SUPPORTING_HISTORY |
| client_decisions | 6 | 3 | Client shortlist/reject decisions on a match | via match | SUPPORTING_HISTORY |
| interviews | 0 | 14 | Interview lifecycle | via match | CANONICAL |
| messages | 0 | 8 | Thread messages | via thread/org | CANONICAL |
| notifications | 39 | 4 | Per-user notification records (in-app inbox) | recipient_user_id | CANONICAL |
| notification_events | 22 | 3 | Lifecycle event log (fan-out source) | organization_id | CANONICAL |
| notification_deliveries | 11 | 2 | Per-channel delivery attempts | via event | SUPPORTING_HISTORY |
| client_notification_preferences | 0 | 3 | Per-user notification opt-outs | user_id | CANONICAL |
| intake_submissions | 7 | 14 | Public intake payload | pending → org | CANONICAL |
| contact_messages | 1 | 1 | Public contact form | none | CANONICAL |
| processing_jobs | 158 | 13 | Async work queue for candidates | via entity | PROCESSING |
| audit_events | 611 | 27 | Universal audit trail | organization_id | SUPPORTING_HISTORY |
| support_sessions | 39 | 4 | Admin "view as client" sessions | organization_id | CANONICAL |
| support_actions | 0 | 0 | Actions taken during support session | via session | REVIEW_REQUIRED (no writers wired) |
| trace_index | 0 | 0 | Correlation trace lookup | trace_id | REVIEW_REQUIRED (writer not wired) |
| cost_limits | 7 | 0 | AI cost caps | organization_id | REVIEW_REQUIRED (no UI reader) |
| provider_usage_events | 0 | 0 | AI usage log | organization_id | REVIEW_REQUIRED (no writer) |
| retention_policies | 15 | 0 | GDPR retention config | organization_id | REVIEW_REQUIRED (no UI) |
| retention_runs | 0 | 0 | GDPR retention executions | organization_id | REVIEW_REQUIRED (no writer) |
| consent_records | 0 | 0 | GDPR consent log | user | REVIEW_REQUIRED |
| data_subject_requests | 0 | 0 | GDPR DSR queue | user | REVIEW_REQUIRED |
| export_jobs | 0 | 0 | User export jobs | user | REVIEW_REQUIRED |
| saved_views | 0 | 0 | Saved filter views (Search fn wired, no UI) | user | UNUSED |
| migration_runs | 2 | 0 | V2 migration bookkeeping | none | LEGACY |
| migration_entity_results | 11 | 0 | V2 migration per-entity results | none | LEGACY |
| migration_rejections | 0 | 0 | V2 migration failures | none | LEGACY |
| legacy_identity_map | 0 | 0 | Legacy → destination user map | none | LEGACY |
| legacy_organization_map | 0 | 0 | " orgs | none | LEGACY |
| legacy_candidate_map | 0 | 0 | " candidates | none | LEGACY |
| legacy_position_map | 0 | 0 | " positions | none | LEGACY |
| legacy_application_map | 0 | 0 | " applications | none | LEGACY |
| legacy_submission_map | 0 | 0 | " submissions | none | LEGACY |
| legacy_score_map | 0 | 0 | " scores | none | LEGACY |
| legacy_file_map | 0 | 0 | " files | none | LEGACY |

## 8. Views (13, all CANONICAL_READ_MODEL)

| View | Consumers | Backed by |
|---|---|---|
| admin_clients_view | `/admin/clients` | organizations + memberships |
| admin_positions_view | `/admin/positions` | positions + orgs + match counts |
| admin_candidate_matches_view | `/admin/candidates` | candidate_matches + profiles + score_runs |
| admin_pipeline_health | `/admin` overview | processing_jobs + score_runs |
| admin_work_inbox | `/admin` urgent items | intake + matches + jobs |
| client_positions_view | `/client/positions` | positions filtered by org |
| client_candidate_matches_view | `/client/candidates` | matches WHERE client_visibility='visible' |
| client_kanban_view | Client Kanban | matches grouped by stage |
| client_dashboard_kpis | Client Overview KPIs | matches aggregated |
| client_messages_view | Client Messages | messages joined to threads |
| candidate_profile_view | `/me/profile` | candidate_profiles + files |
| candidate_my_applications | `/me/applications` | applications + matches + positions |
| candidate_messages_view | `/me/messages` | messages scoped to candidate |

No materialized views.

## 9. RPCs / helpers (19)

- Access helpers (`SECURITY DEFINER`, `search_path=public`): `has_role`, `has_org_role`, `is_active_user`, `is_org_admin`, `is_org_editor`, `is_org_viewer`, `is_org_member`, `is_owning_candidate`, `is_platform_staff`.
- Domain helper: `scoring_readiness(_match_id)` — used by Publish Desk.
- Triggers: `tg_candidate_matches_publish_gate`, `tg_positions_lifecycle_guard`, `tg_score_runs_identity`, `tg_score_runs_immutable`, `tg_support_session_guard`, `tg_touch_processing_updated_at`, `tg_touch_updated_at`, `tg_write_audit_event`.
- `_mig_touch_updated_at` — LEGACY (migration-only).

## 10. Frontend query surfaces (top offenders)

Ranked by `.from()` call count in `src/`:

1. `candidate_matches` — 64 (dashboards + kanban + detail + comparison)
2. `candidate_profiles` — 40
3. `positions` — 37
4. `memberships` — 37
5. `organizations` — 30
6. `audit_events` — 27
7. `profiles` — 21

Most of these should go through the corresponding `*_view` (see § 8) instead of ad-hoc joins in components. See `duplicate-source-report.md` §"Excessive client-side joins".

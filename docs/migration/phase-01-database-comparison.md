# Phase 01 — Database Comparison

Original DB (`qldhdrxdnrnwbkaxozno`) cannot be queried from this workspace. Its schema is inferred from `supabase/migrations/*` filenames (671 migration files spanning 2026-02 → present), edge-function names, and page-name conventions. **Absolute record counts, indexes, RLS policies, triggers, enums, extensions, and cron jobs on the original DB must be supplied by the owner (pg_dump or read-only SQL access) before Phase 3 can produce numeric answers.**

New DB (`nfwetiyrxsrejdodvale`, Lovable Cloud, Tiny): fully inspectable.

## 1. Entity map — canonical concepts

| Canonical entity | Original (inferred) | New (`public.*`) | Migration importance |
|---|---|---|---|
| Tenants | `tenants` / `organizations` (see `manage-client-users`, `delete-tenant`, `?tenant=<id>` query) | `organizations` (22 cols, 4 RLS) | **critical** — canonical id; must be reconciled |
| Users | `auth.users` + `profiles` | `auth.users` + `profiles` (14 cols) | critical |
| Roles | likely `role` column on profile/membership | `user_roles` (4 cols) + SECURITY-DEFINER `has_role()` | new is stronger (privilege-escalation-safe); migrate roles into new model |
| Memberships | likely `client_users` / `team_members` | `memberships` (10 cols) | critical |
| Client intake submissions | inferred from `submit-intake`/`get-intake-status` + `release-qa-intake` | `intake_submissions` (16 cols) | critical |
| Positions / requisitions / jobs | multiple legacy names (`requisitions`, `jobs`, `positions`) | `positions` (27 cols, 6 RLS) | critical |
| Screening questions | `generate-screening-questions` | `screening_questions` (12 cols) | important |
| Job postings | fused into positions in new | positions | rebuild-in-place |
| Candidate profiles | `candidates` / `candidate_profiles` (+ legacy: see `bulk-reclassify-submissions`) | `candidate_profiles` (26 cols) | critical |
| Applications | `applications` (see `delete-application`, `bulk-repair-application-links`) | `applications` (13 cols) | critical |
| Application answers | inferred | `application_answers` (6 cols) | important |
| Candidate submissions / matches | multiple concepts (`match-candidates`, guest applications) | `candidate_matches` (22 cols) | critical — one match = (candidate × position) score identity |
| CV files | Supabase Storage bucket + `serve-cv`/`replace-cv` | `files` (19 cols) + Storage `cvs` bucket | critical |
| Parsing artifacts | `parse-cv`/`parse-candidate-cv` — likely a `parse_artifacts` table | (fused into candidate_evidence + candidate_profiles.raw_cv fields) | needs decision |
| Evidence graphs | `candidate_evidence` implied | `candidate_evidence` (9 cols) | critical |
| Enrichment records | dozens of enrichment edge functions | `candidate_profiles` (scalar) + planned enrichment table | rebuild |
| Scoring blueprints | `generate-role-blueprint`, `calibrate-role` | position-scoped blueprint in `positions` metadata (per Phase 6 report) | rebuild |
| Scoring runs | `score_runs`/`recalculate-scores`/`backfill-score-runs` | `score_runs` (24 cols, immutable trigger) | critical |
| Score decisions | `admin-regenerate-score-explanations` | `score_decisions` (8 cols) | important |
| Client decisions | shortlist/interview/hire flows | `client_decisions` (8 cols) | critical |
| Interviews | `interview-feedback-reminder` | `interviews` (11 cols) | important |
| Messages | `relay-message` | `messages` (7 cols) + realtime | critical |
| Notifications | many `notify-*` edge fns | `notifications` (11 cols) + `notification_events` (11 cols) + `notification_deliveries` (9 cols) | critical |
| Audit / journal | `audit-*`, `integrity-*` | `audit_events` (10 cols), `trace_index` (10 cols) | critical |
| Processing queue | `process-candidate-queue`, `admin-run-candidate-queue` | `processing_jobs` (12 cols) + pg_cron | critical |
| Consent / DSAR | `check-consent-expiry` | `consent_records` (13 cols), `data_subject_requests` (14 cols), `retention_policies`, `retention_runs`, `export_jobs` | important |
| Cost / usage | none obvious | `provider_usage_events`, `cost_limits` | new-only |
| Saved views | admin lists | `saved_views` (10 cols) | new-only |
| Support sessions ("view as client") | admin impersonation via `?tenant=` | `support_sessions` (16 cols) + `support_actions` (12 cols) | new-only |

Views in new project (13, all in `public`):
`admin_candidate_matches_view`, `admin_clients_view`, `admin_pipeline_health`, `admin_positions_view`, `admin_work_inbox`, `candidate_messages_view`, `candidate_my_applications`, `candidate_profile_view`, `client_candidate_matches_view`, `client_dashboard_kpis`, `client_kanban_view`, `client_messages_view`, `client_positions_view`.

## 2. Row counts (new project — QA seed only)
See counts in `phase-01-new-project-map.md`. Highlights: 32 auth users, 12 orgs, 100 candidates, 98 applications, 98 candidate_matches, 11 score_runs, 154 processing_jobs, 473 audit_events, 18 CV files in Storage.

## 3. Original-only concepts likely to require migration decisions
- **Legacy candidates** — `bulk-reclassify-submissions`, `backfill-legacy-applications` imply a legacy candidate/submission model split.
- **Prime Global campaign** family — 5 dedicated edge functions + tables (dry-run, test-send, history, QA, production-send).
- **Danger band review** — `danger-band-cv-url`, `danger-band-review`, likely a `danger_band_*` table.
- **Integrity command centre** — 10+ integrity-related tables likely (`integrity_*`).
- **Chat / knowledge base** — `ask-taasflow` embedding table.
- **Marketplace previews** — `reconcile-marketplace-previews` implies `marketplace_*` tables.

Each of these is a **product decision** in Phase 3: keep, rebuild, or exclude.

## 4. RLS / security posture
- New: RLS enabled on **all** listed tables (policies visible in table meta — see `<supabase-tables>` block); tenant isolation via `is_org_member()` + role-aware helpers (Phase 3); `has_role()` restricted to `service_role`.
- Original: RLS was retro-fitted across 671 migrations; policy quality varies (legacy `manage-client-users`, `repair-client-access`, `signup-abuse-guard` suggest historical gaps). Cannot audit without SQL access.

## 5. Missing access blockers
- SQL access to `qldhdrxdnrnwbkaxozno` (or a schema-only `pg_dump` + `SELECT count(*)` per public table).
- List of pg_cron schedules on the original.
- List of DB extensions on the original (`pg_net`, `pg_trgm`, `vector`, etc.).

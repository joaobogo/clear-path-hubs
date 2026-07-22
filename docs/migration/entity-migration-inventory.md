# Phase 2 — Entity & Data Migration Inventory

**Migration run:** `MIG-2026-07-22-001` · **Source:** legacy `qldhdrxdnrnwbkaxozno` (Talent Streamline) · **Destination:** canonical `nfwetiyrxsrejdodvale` (Clear Path Hubs) · **Read/write posture:** source read-only pending owner grant, destination not modified in this phase.

## Scope of this pass

This document classifies every legacy public-schema entity into one of the seven decision codes and maps it to the destination canonical model. It is produced from static introspection of the legacy repo (`supabase/migrations/*` and `src/integrations/supabase/types.ts`) — no legacy database was queried because credentials are not yet available.

**Per-record numeric fields (source_record_count, verified_records, duplicate_records, orphan_records, test_records, missing_tenant_linkage, missing_identity_linkage) are intentionally left NULL** in the JSON companion. They MUST be filled by a dry-run reconciliation pass once read-only Postgres credentials for `qldhdrxdnrnwbkaxozno` are supplied. That pass is Phase 3, not Phase 2.

## Totals

| Bucket | Count |
|---|---|
| Total source entities cataloged | 118 |
| MIGRATE_ALL_VERIFIED / MIGRATE_ACTIVE_ONLY | 27 |
| MIGRATE_HISTORY | 10 |
| MIGRATE_FILES_SEPARATELY | 3 |
| REBUILD_FROM_CANONICAL_DATA | 21 |
| DO_NOT_MIGRATE | 42 |
| REQUIRES_REVIEW | 15 |

Numbers are entity counts, not record counts. Record counts are pending source access.

## Decision table

Full row-by-row table lives in `entity-migration-inventory.json`. Highlights below.

### MIGRATE_ALL_VERIFIED (core production data)
`auth.users` → `auth.users` + `profiles` · `profiles` → `profiles` · `tenants` → `organizations` · `user_roles` → `user_roles` + `memberships` · `requisitions` (active/approved) → `positions` · `job_postings` → `positions` (public fields) · `candidate_questions` → `screening_questions` · `candidates` + `candidate_profiles` (merged) → `candidate_profiles` · `candidate_client_profiles` → `candidate_matches` (client_view fields) · `job_applications` → `applications` + `candidate_matches` · `candidate_submissions` → `candidate_matches` · `candidate_answers` → `application_answers` · `interview_schedules` (active) → `interviews` · `message_threads` + `messages` → `messages` · `notification_settings` → `profiles.notification_prefs`.

### MIGRATE_ACTIVE_ONLY
`candidate_intake_drafts` (30d) · `candidate_cv_replacement_requests` (open) · `candidate_follow_ups` (open) · `notifications` (unread + 30d).

### MIGRATE_HISTORY (immutable/audit-worthy)
Closed `requisitions` · `job_posting_revisions` · `job_status_history` · `pipeline_stage_history` · `pilot_intakes` · `consent_logs` → `consent_records` · `audit_logs` (180d) · `system_incidents` (180d) · `score_runs` (completed + non-empty evidence + identity match) · `score_audit_trail` · `score_change_log` · `scoring_audit_log` · `scoring_intake_incidents` · `scoring_lifecycle_audit` · `candidate_change_history` · `candidate_collaboration_events` · `candidate_journey_incidents` · `candidate_processing_logs` (errors) · `candidate_processing_runs` (terminal) · `candidate_enrichment_history` · `notification_send_log` + `notification_delivery_log` (90d) → `notification_deliveries` · `message_reports`. Non-audit-target rows are converted into `audit_events` entries with `migration_source_id` provenance.

### MIGRATE_FILES_SEPARATELY (Storage)
Candidate CVs (source `cvs` bucket) · `intake_attachments` (bucket TBC) · `candidate_drop_packages` (client-facing files). Signed-URL download from source, re-upload to destination bucket, then insert the `files` row — never migrate legacy URLs directly.

### REBUILD_FROM_CANONICAL_DATA (derived / rebuild fresh)
`candidate_identity_map` (rebuilt as internal migration map only) · `candidate_drop_packages` (views over `candidate_matches`) · `candidate_parse_artifacts` (re-parse under new `HYDRATION_PARSER_VERSION`) · `candidate_enriched_profiles` (re-run enrichment) · `candidate_enrichment_evidence` → `candidate_evidence` (re-derive) · `candidate_evidence_graphs` (re-run) · `candidate_field_provenance` (regenerated in hydration) · `candidate_processing_items/queue` (re-enqueue from state) · `candidate_profile_enrichments` (re-run) · `score_evidence_items` (embedded in `score_runs.evidence` JSONB) · all analytics views (`enriched_candidate_profiles`, `job_applications_admin_view`, `v_application_scoring_health`, `application_completion_analytics`, `question_performance_summary`) · `requisition_market_intelligence` · `saved_jobs`.

### DO_NOT_MIGRATE (excluded)
All runtime queues, locks, dedupe caches, and repair infrastructure — `background_jobs`, `background_repair_actions`, `backfill_rescore_jobs`, `bulk_scoring_jobs`, `calibration_suggestions`, `score_backfill_attempts`, `score_freeze_violations`, `score_run_backfill_jobs`, `scoring_alert_state`, `scoring_anomalies`, `scoring_anomaly_scan_runs`, `scoring_audit_results`, `scoring_batch_runs`, `scoring_benchmarks`, `scoring_calibration_runs`, `scoring_locks`, `scoring_rollout_guard`, `scoring_run_logs`, `failed_scoring_attempts`, `pending_backfill_reviews`, `candidate_processing_locks`, `candidate_processing_run_logs`, `candidate_intake_backup`, `candidate_enrichment_suggestions`, `auth_repair_log`, `repair_audit_log`, `repair_dedupe_keys`, all `integrity_*` tables, `anomaly_scan_watermarks`, `alert_events`, `application_attempt_stages`, `application_health_checks`, `application_tracking_tokens`, `allowed_submission_stage_transitions` (encoded in code), `crm_sync_queue`, `profile_views`, `qa_journey_events`, `question_analytics_events`, `rate_limits`, `release_gate_runs`, `secrets`, `simple_captcha_challenges`, `simple_security_challenges`, `feature_flags`, `lifecycle_event_dedupe`, `relay_messages`, `outbound_email_recipients`, `platform_email_*`, `candidate_email_campaign_sends/send_locks/qa_approvals/test_approvals`, `email_delivery_events`, `email_send_log`, `prime_global_candidate_reasoning` (global-candidate scores explicitly excluded).

**Secrets are never copied.** Regenerate via `secrets--add_secret` on the destination.

### REQUIRES_REVIEW (product decision needed before Phase 3)
`candidate_profiles_secure` (source-of-truth conflict with `candidate_profiles`) · `scoring_feedback` · `scoring_overrides` · `scoring_review_feedback` · `manual_scoring_history` · `explanation_reviews` · `talent_inquiries` · `talent_pools` + `talent_pool_members` · `alert_rules` · `chat_conversations` · `leads` · `newsletter_subscribers` · `outreach_activities` + `outreach_prospects` + `sourcing_strategies` · `onboarding_checklists` + `onboarding_items` + `onboarding_requests` · `payments` · reference dictionaries (`skills`, `industries`, `languages`, `field_translations`) · `team_contacts`. Marketing/outreach/onboarding surfaces have no destination equivalent yet — product must decide whether to add scope, drop the data, or freeze it in the legacy system.

## Risk classification

- **HIGH RISK**: `auth.users`, `candidate_profiles`, `candidate_matches`, `applications`, `score_runs`, `files` — any identity or tenant mismatch corrupts every downstream table. Every insert must go through the migration provenance path defined in `canonical-database-decision.md` §4–§5 (write-if-missing, no overwrite of verified destination rows).
- **MEDIUM RISK**: `messages`, `interviews`, `client_decisions`, `notifications` — safe as long as parent rows migrated first and tenant scoping is preserved.
- **LOW RISK**: audit/history conversions into `audit_events`, one-way pilot intakes.

## Blockers (return code details)

1. Read-only DB credentials for legacy `qldhdrxdnrnwbkaxozno` are missing. Per-record numbers cannot be computed. Everything else in this document is stable without that access.
2. 15 entities are `REQUIRES_REVIEW`. Product owner must sign off on each before Phase 3 dry-run runs, otherwise the reconciler cannot decide whether a row is destined for the canonical DB or the drop pile.
3. Storage bucket inventory for the source project (bucket names beyond `cvs`, object counts, total bytes, MIME distribution) is unknown; needed to size the file-copy phase.

## Return

- **total source entities**: 118
- **total records considered**: UNKNOWN_PENDING_SOURCE_READ_ONLY_ACCESS
- **migrate count**: 27 (MIGRATE_ALL_VERIFIED + MIGRATE_ACTIVE_ONLY) + 10 (MIGRATE_HISTORY) + 3 (MIGRATE_FILES_SEPARATELY) = **40 entities to migrate**
- **rebuild count**: 21
- **exclude count**: 42
- **manual-review count**: 15
- **blockers**: 3 (see above)
- **Verdict**: **FAIL** — inventory is complete at entity granularity, but the phase deliverable also requires per-record counts (verified/duplicate/orphan/test/missing-tenant/missing-identity), and those cannot be produced without legacy read-only credentials. Phase 2 re-runs to `PASS` the moment those credentials are supplied and the count columns are filled.

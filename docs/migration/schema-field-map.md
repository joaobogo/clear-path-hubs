# Phase 3 — Schema & Field Map (Old → New)

**Migration run:** `MIG-2026-07-22-001` · **Version:** `v1.0.0` · **Source:** legacy `qldhdrxdnrnwbkaxozno` · **Destination:** canonical `nfwetiyrxsrejdodvale`. No data is migrated in this phase.

Full machine-readable map: `docs/migration/schema-field-map.json`. This document narrates the same map for humans and captures rejected concepts, ambiguous relationships, and the destination migrations that must land before Phase 4 (dry-run) can execute.

## 1. Global rules that apply to every mapping

**Provenance** — every destination row created by the migration carries:

```
legacy_source_system TEXT   'taasflow-legacy'
legacy_source_table  TEXT   e.g. 'candidate_submissions'
legacy_source_id     TEXT   the legacy primary key as text
migrated_at          TIMESTAMPTZ
migration_run_id     TEXT   'MIG-2026-07-22-001'
migration_version    TEXT   'v1.0.0'
migration_status     TEXT   'imported' | 'verified' | 'superseded' | 'rejected'
```

Enforced per-table by `UNIQUE (legacy_source_table, legacy_source_id)`.

**Conflict policy (applied in order for every entity):**

1. Match by `legacy_source_id` first (via `migration_*_map` tables).
2. For Auth: match by uid, then by verified normalized email — only when safe.
3. For orgs: match by verified ownership/domain — never by company-name similarity.
4. Never fuzzy-match candidates by name alone.
5. Never fuzzy-match clients by similar company names.
6. Never overwrite a newer verified destination value (`migration_status = 'verified'` OR `updated_at > migration_run_started_at`).
7. Never merge two candidates without explicit identity evidence (uid, verified email, or E.164 phone).
8. Never reuse a score across different positions (enforced by `tg_score_runs_identity`).
9. Preserve immutable historical scoring runs (enforced by `tg_score_runs_immutable`).
10. Reject ambiguous records into `public.migration_review_queue`.

**Scoring identity contract (non-negotiable):**

```
Candidate Profile + Position = Candidate Match + role-specific Score Runs
```

There is no candidate-level global score in the destination. Any legacy `prime_global_candidate_reasoning`, `scoring_benchmarks`, or global candidate score is dropped.

## 2. Entity mappings (summary)

| Logical entity | Source table(s) | Destination table(s) | Idempotency key |
|---|---|---|---|
| users | `auth.users` | `auth.users` + `public.profiles` | `migration_user_map.legacy_uid` |
| profiles | `public.profiles` | `public.profiles` | `(legacy_source_table='profiles', legacy_source_id)` |
| organizations | `public.tenants` | `public.organizations` | `migration_org_map.legacy_tenant_id` |
| memberships | `public.user_roles` (+ tenant links) | `public.memberships` + `public.user_roles` | `(legacy_source_table='user_roles', legacy_source_id)` |
| positions | `public.requisitions` + `public.job_postings` | `public.positions` | `(legacy_source_table='requisitions', legacy_source_id)` |
| screening_questions | `public.candidate_questions` | `public.screening_questions` | `(legacy_source_table='candidate_questions', legacy_source_id)` |
| candidates | `public.candidates` + `candidate_profiles` (+ `_secure`) | `public.candidate_profiles` | `migration_candidate_map.(legacy_id, legacy_table)` |
| applications | `public.job_applications` | `public.applications` (+ `candidate_matches`) | `(legacy_source_table='job_applications', legacy_source_id)` |
| submissions / matches | `public.candidate_submissions` | `public.candidate_matches` | `(legacy_source_table='candidate_submissions', legacy_source_id)` |
| CV files (rows + objects) | Storage `cvs` + `public.files` | Storage `cvs` + `public.files` | `sha256` (object) + `(legacy_source_table='files', legacy_source_id)` (row) |
| parse artifacts | `candidate_parse_artifacts` | REBUILT via HYDRATION_PARSER_VERSION | n/a — not imported |
| evidence | `candidate_enrichment_evidence`, `candidate_evidence_graphs` | REBUILT into `candidate_evidence` + `score_runs.evidence` | n/a — not imported |
| enrichment | `candidate_enriched_profiles`, `candidate_profile_enrichments` | REBUILT into `candidate_profiles` | n/a — not imported |
| scoring blueprints | `scoring_overrides`, `scoring_feedback`, `manual_scoring_history` | REQUIRES_REVIEW — no equivalent | n/a |
| scoring runs | `public.score_runs` | `public.score_runs` (immutable) | `(legacy_source_table='score_runs', legacy_source_id)` |
| reviews | `explanation_reviews`, `scoring_review_feedback` | REQUIRES_REVIEW | n/a |
| publication | `job_postings.published_at`, `candidate_submissions.visibility_to_client` | `positions.published_at`, `candidate_matches.visibility_to_client` (re-derived via publish gate) | inherited |
| decisions | `pipeline_stage_history` (+ `candidate_submissions.current_stage`) | `public.client_decisions` | `(legacy_source_table='pipeline_stage_history', legacy_source_id)` |
| interviews | `public.interview_schedules` | `public.interviews` | `(legacy_source_table='interview_schedules', legacy_source_id)` |
| messages | `message_threads` + `messages` | `public.messages` | `(legacy_source_table='messages', legacy_source_id)` |
| audit history | `audit_logs`, `system_incidents`, `candidate_change_history`, `candidate_collaboration_events`, `candidate_journey_incidents`, `candidate_enrichment_history`, `candidate_processing_logs` (errors), `job_posting_revisions`, `job_status_history`, `score_audit_trail`, `score_change_log`, `scoring_audit_log`, `scoring_intake_incidents`, `scoring_lifecycle_audit`, `message_reports` | `public.audit_events` | `(legacy_source_table, legacy_source_id)` |

Field-by-field details, enum maps, null handling, array handling, JSON handling, validation, and rejection rules for every logical entity are in the JSON companion under `entities[].field_map`, `enum_transformations`, `validation`, and `rejection`.

## 3. Rejected legacy concepts

- **Global candidate score / candidate-level "prime" reasoning** — violates the scoring identity contract. Not mapped anywhere.
- **Legacy `crm_sync_queue` (RecruitCRM bridge)** — integration deprecated in destination.
- **Runtime queues / locks / dedupe caches** — `background_jobs`, `background_repair_actions`, `backfill_rescore_jobs`, `scoring_locks`, `scoring_alert_state`, `candidate_processing_locks`, `application_health_checks`, `rate_limits`, `lifecycle_event_dedupe`, all `integrity_*`.
- **Anomaly/QA telemetry** — `scoring_anomalies`, `scoring_anomaly_scan_runs`, `scoring_benchmarks`, `scoring_batch_runs`, `scoring_calibration_runs`, `scoring_audit_results`, `qa_journey_events`, `question_analytics_events`, `application_attempt_stages`.
- **Marketing/outreach/onboarding surfaces without destination equivalents** — `candidate_email_campaign_*`, `outbound_email_recipients`, `platform_email_*`, `outreach_activities`, `outreach_prospects`, `sourcing_strategies`, `onboarding_*`, `payments` — held in REQUIRES_REVIEW until product decides.
- **Signed URLs / recovery tokens / encrypted passwords / `secrets` table** — never copied. Passwords are re-issued via password-reset email; secrets recreated via `secrets--add_secret`.
- **Legacy `candidate_field_provenance`** — regenerated during hydration; do not import.
- **`allowed_submission_stage_transitions` table** — destination encodes the stage graph in code (`STAGE_GRAPH`).

## 4. Ambiguous relationships (must be resolved before Phase 4)

1. **`candidate_profiles` vs `candidate_profiles_secure`** — two legacy tables carry overlapping PII with different write paths. Product must declare a single source-of-truth per column, or reject rows where the two disagree.
2. **Legacy `user_roles.role` values `'recruiter'` and `'ops'`** — some rows describe platform staff (`operations`), others describe client-side editors (`client_editor`). No discriminator column exists in legacy. Migration must consult per-user tenant linkage (rows tied to a real tenant → client-side; rows tied to platform-owner tenant → operations) and reject the residue to the review queue.
3. **`candidate_submissions.current_stage` vs `pipeline_stage_history` latest event** — divergence exists in legacy. Rule: history event wins; `current_stage` is treated as a hint only.
4. **`job_applications` with no `job_posting_id` (direct-import applications)** — cannot resolve `position_id`. Reject unless product supplies a fallback position.
5. **`message_threads` without a resolvable `(position, candidate_profile)` pairing** — destination has no free-floating threads. Reject.
6. **Legacy applications whose `candidate_id` resolves via email to two distinct destination candidate_profiles** — reject both to review queue.
7. **`interview_schedules` with attendees who are not migrated users** — keep as email-only attendee entries; don't reject the interview.
8. **Storage objects present in `cvs` bucket with no matching `files` row** — treat as orphan; reject unless owner-hinted via filename convention.
9. **`score_runs` referring to legacy `candidate_id` (no `candidate_match_id`)** — legacy schema evolved mid-life. Only rows with a resolvable `(candidate_match, position)` pair are imported; the rest are dropped as they cannot satisfy `tg_score_runs_identity`.

## 5. Required destination migrations (must land before Phase 4)

These are the schema changes the destination needs so the migration can write provenance and dedupe safely. They are **listed here, not executed**, per the "do not migrate data yet" instruction. Phase 4 will approve and run them as a single migration.

1. `CREATE TABLE public.migration_review_queue (...)`.
2. `CREATE TABLE public.migration_user_map (legacy_uid uuid PRIMARY KEY, new_uid uuid NOT NULL UNIQUE, matched_by text CHECK (matched_by IN ('uid','email_verified')), created_at timestamptz NOT NULL DEFAULT now())`.
3. `CREATE TABLE public.migration_org_map (legacy_tenant_id uuid PRIMARY KEY, new_org_id uuid NOT NULL UNIQUE, matched_by text CHECK (matched_by IN ('legacy_id','domain','owner_email')), created_at timestamptz NOT NULL DEFAULT now())`.
4. `CREATE TABLE public.migration_candidate_map (legacy_id uuid NOT NULL, legacy_table text NOT NULL, new_candidate_profile_id uuid NOT NULL, matched_by text CHECK (matched_by IN ('legacy_id','email','phone','manual')), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (legacy_id, legacy_table))`.
5. Add the 7 provenance columns to: `profiles, organizations, memberships, positions, screening_questions, candidate_profiles, applications, application_answers, candidate_matches, files, candidate_evidence, score_runs, client_decisions, interviews, messages, notifications, audit_events, intake_submissions, consent_records`.
6. Add `UNIQUE (legacy_source_table, legacy_source_id)` partial index (WHERE `legacy_source_id IS NOT NULL`) on each of those tables.
7. Grant all new tables per project GRANT convention: `authenticated` gets no direct access (migration runs under `service_role`); `service_role` gets `ALL`.
8. Enable RLS on the three `migration_*_map` tables and `migration_review_queue` with `USING (false)` for `authenticated` (service-role only).

## 6. Return

- **mapped entities**: 21 logical entities across 118 legacy tables (see §2)
- **unmapped fields** (highest-signal):
  - legacy `candidate_profiles.global_score` / any candidate-level aggregate score
  - legacy `candidate_submissions.client_view_snapshot` (regenerated)
  - legacy `candidate_field_provenance` (regenerated)
  - legacy `secrets.*`, `signed_urls`, `encrypted_password`, `recovery_token`
  - legacy `notification_settings.*` remaining keys not covered by `profiles.notification_prefs`
  - legacy `feature_flags`, `rate_limits`, `lifecycle_event_dedupe`
  - legacy `job_applications.ip_address`, `user_agent`
- **rejected legacy concepts**: global candidate scores, RecruitCRM sync queue, runtime queues/locks, anomaly/QA telemetry, marketing/outreach/onboarding surfaces (pending product decision), secrets, signed URLs, tokens, legacy provenance, `allowed_submission_stage_transitions`.
- **ambiguous relationships**: 9 items in §4, all must be resolved before Phase 4.
- **required destination migrations**: 8 items in §5.
- **Verdict: PASS** — mapping is complete and internally consistent for every non-REQUIRES_REVIEW entity. The REQUIRES_REVIEW items from Phase 2 remain out of scope until product signs off, and the §4 ambiguities have explicit deterministic tie-breakers or explicit rejection paths, so the map is executable as-is.

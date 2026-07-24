# TaaSFlow Canonical Data Model

_Source of truth for the synchronized hiring workspace. Every client, candidate, and admin dashboard reads from these tables — no dashboard keeps its own copy._

## Design principles

- **One record, many views.** Moving a candidate to Interview updates the client pipeline, admin ops view, analytics, timeline, and notifications from a single row transition on `candidate_matches` — never from parallel per-dashboard state.
- **Global identity vs. per-role application.** `candidate_profiles` holds the person (name, contact, CV, evidence). `applications` + `candidate_matches` hold their participation in a specific `positions` row. One candidate can appear in many role processes without collision.
- **Append-only where auditability matters.** Stage transitions (`candidate_stage_history`), score runs (`score_runs`), position snapshots (`position_versions`), and audit events (`audit_events`) cannot be updated or deleted from the app — triggers reject `UPDATE`/`DELETE`.
- **Tenant isolation in the database, not the UI.** Every table with organization data has RLS scoped through `is_org_member` / `is_org_editor` / `is_org_admin` / `is_platform_staff`. Hiding a menu is never authorization.
- **Reproducible scoring.** `score_runs` records `blueprint_version` + `engine_version`; `position_versions` snapshots the exact requirements/dealbreakers used, so a score can always be re-explained.

## Domain map

### 1. Identity, access, and tenancy
| Table | Purpose |
| --- | --- |
| `organizations` | Client workspaces (supports parent/child for enterprise units) |
| `profiles` | Human-facing user record linked to `auth.users` |
| `memberships` | User ↔ organization ↔ role (owner, admin, editor, viewer, platform_admin, operations). `status` covers `invited`, `active`, `revoked` |
| `user_roles` | Global app roles (used by legacy `has_role`) |
| `consent_records` | Terms/Privacy acceptance snapshots |
| `support_sessions` + `support_actions` | Platform-staff impersonation trail |

### 2. Positions and rubrics
| Table | Purpose |
| --- | --- |
| `positions` | Live role definition (requirements, preferred, dealbreakers, rubric config, lifecycle status) |
| `position_versions` **(new)** | Immutable snapshot of a position at a point in time; every score run can be re-explained against the exact version |
| `intake_submissions` | Raw 5-step intake wizard payloads |
| `screening_questions` | Structured qualifiers / disqualifiers / validation questions attached to a position |
| `role_memory` | Recruiter memory of the role brief (context, priorities, notes) |

### 3. Candidates, applications, and evidence
| Table | Purpose |
| --- | --- |
| `candidate_profiles` | Global candidate identity, current CV pointer, contact info |
| `files` | CV binaries in the `cvs` storage bucket + extraction state |
| `applications` | A candidate's submission to a specific position (6-char reference id) |
| `application_answers` | Screening question responses per application |
| `candidate_matches` | The join across candidate + position + org that dashboards read from. Carries `stage`, `admin_status`, `client_visibility`, `processing_state`, and pointers to the current/approved score run |
| `candidate_evidence` | Structured evidence items extracted from the CV, per requirement |
| `score_runs` | Immutable scoring run (evidence array, raw/applied/final, blueprint & engine versions, contradiction status) |
| `score_decisions` | Reviewer overrides and admin approvals attached to a run |
| `talent_pools` + `talent_pool_members` | Silver-medalist / rediscovery pools |
| `talent_memory` + `talent_memory_events` | Long-lived memory of past candidates |

### 4. Pipeline, decisions, and lifecycle
| Table | Purpose |
| --- | --- |
| `candidate_stage_history` **(new)** | **Immutable, attributable** log of every stage transition on `candidate_matches`. Auto-written by a trigger; `UPDATE`/`DELETE` rejected. This is the single source for pipeline analytics, activity timelines, and stage audits |
| `client_decisions` | Client-facing yes/no/hold decisions |
| `interviews` | Scheduled interviews + outcomes |
| `hire_records` | Offer → accepted/declined → hired lifecycle, with `close_reason` on losses |
| `tasks` **(new)** | Next actions (follow up, schedule interview, review evidence, send offer). Assignee, due date, priority, status — the workspace's shared to-do surface |

### 5. Communication and delivery
| Table | Purpose |
| --- | --- |
| `messages` | Threaded messages tied to a candidate/match/application |
| `notifications` + `notification_events` + `notification_deliveries` | User-facing notifications with per-channel delivery state |
| `shortlist_shares` + `shortlist_share_comments` | Token-gated stakeholder share links |
| `client_notification_preferences` | Per-user per-workspace channel prefs |

### 6. AI assistants
| Table | Purpose |
| --- | --- |
| `assistant_conversations` + `assistant_messages` | Client AI assistant transcripts |
| `admin_copilot_conversations` + `admin_copilot_messages` | Admin copilot transcripts |
| `assistant_audit_events` | Every tool call the assistant made, with confidence + citations |

### 7. Governance
| Table | Purpose |
| --- | --- |
| `audit_events` | Cross-cutting audit log written by `tg_write_audit_event` |
| `business_rules_overrides` + `business_rules_audit` | Platform-admin overrides of canonical rules (delivery promise, packages, scoring) |
| `retention_policies` + `retention_runs` | Data-retention enforcement |
| `data_subject_requests` | GDPR/DSAR handling |
| `export_jobs` | Async exports (deliveries, CSVs) |
| `processing_jobs` | Async CV parsing + scoring job queue |
| `provider_usage_events` + `cost_limits` | Model spend / rate limits |
| `saved_views` | Per-user dashboard filter presets |

## Append-only guarantees (enforced by triggers)

| Table | Guarantee | Trigger |
| --- | --- | --- |
| `candidate_stage_history` | No `UPDATE` / `DELETE` | `tg_stage_history_immutable` |
| `position_versions` | No `UPDATE` / `DELETE` | `tg_position_versions_immutable` |
| `score_runs` | Cannot mutate a `completed`/`failed`/`cancelled` run (except test rows) | `tg_score_runs_immutable` |
| `candidate_matches` | Cannot flip to `client_visibility='visible'` without an approved score run whose identity matches | `tg_candidate_matches_publish_gate` |
| `candidate_matches` | Every stage change is auto-logged into `candidate_stage_history` | `tg_candidate_matches_log_stage` |

## Reproducibility contract

For any candidate score visible to a client, the system can reconstruct:

1. The position it was scored against — via `score_runs.position_id` → `position_versions` snapshot at run time.
2. The rubric — via `score_runs.blueprint_version` + `engine_version`.
3. The evidence used — via `score_runs.evidence` (jsonb array, required for `completed` runs).
4. Who approved it — via `candidate_matches.approved_score_run_id` + `score_decisions`.
5. Every stage the candidate has passed through — via `candidate_stage_history`.

## Acceptance criteria mapping

| Criterion | Implementation |
| --- | --- |
| No dashboard depends on duplicated records | All dashboards (client, admin, candidate, executive, WBR) read from `candidate_matches` + joined canonical tables. No per-dashboard mirror tables exist. |
| Stage history is immutable and attributable | `candidate_stage_history` + `tg_stage_history_immutable` + auto-log trigger + `actor_user_id` |
| Scoring versions remain reproducible | `score_runs.blueprint_version` + `engine_version` + `position_versions` + append-only triggers |
| One candidate in many role processes without collision | `candidate_profiles` (global) ← `applications` (per role submission) ← `candidate_matches` (per role process) — unique per `(candidate_profile_id, position_id)` at the match level |
| Permissions and org boundaries in the model | `memberships` + `has_org_role` / `is_org_member` / `is_org_editor` / `is_org_admin` / `is_platform_staff` + RLS on every public table |

## Hot-path indexes

- `idx_candidate_matches_org_stage_updated` — client Kanban, admin ops
- `idx_candidate_matches_position_stage` — position detail view
- `idx_positions_org_status` — client positions list
- `idx_applications_position_created` — candidate feed per role
- `idx_stage_history_match_created`, `idx_stage_history_org_created`, `idx_stage_history_position_created` — timeline and analytics reads
- `idx_tasks_org_status`, `idx_tasks_assignee`, `idx_tasks_match` — task inbox and per-candidate action lists
- `idx_position_versions_position` — reproducibility lookups

## What this prompt did NOT change

- No renames, no dropped tables, no destructive migrations.
- No dashboard code was rewired — all reads continue to work against the same tables. New surfaces (tasks UI, stage-history timeline widget) can now be added without further schema work.

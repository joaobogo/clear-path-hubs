# TaaSFlow V2 — Canonical Entity Model

The final data model. One canonical record type per business entity.
Terminology in this document is authoritative; existing table names are
mapped to it explicitly.

## 0. Identity rule (non-negotiable)

- `candidate_profile` = **the person**. One row per human, ever.
- `candidate_submission` = **that person's candidacy for one exact position**.
  One row per `(candidate_profile_id, position_id)`.
- `score_run` = **one score for one exact submission and position**.

No global candidate score. No new profile per role. Every role-specific
record binds `organization_id`, `position_id`, `candidate_profile_id`,
`candidate_submission_id` explicitly and consistently — enforced by
`tg_score_runs_identity`-style triggers where relevant.

## 1. Canonical entities

### 1.1 organization
| | |
|---|---|
| Purpose | Client account (buyer of hiring services). |
| Physical table | `organizations` |
| Primary key | `id uuid` |
| Tenant scope | self (this **is** the tenant). |
| Lifecycle status | `active`, `archived` (`archived_at IS NOT NULL`). |
| Creation authority | `intake-admin.functions.ts` (from converted intake), platform_admin. |
| Update authority | platform_admin, operations, client_admin. |
| Archive behavior | Set `archived_at`; `is_org_member` filters archived. |
| History behavior | `audit_events` per mutation. No soft-delete of children. |

### 1.2 membership
| | |
|---|---|
| Purpose | User ↔ organization link with role. |
| Physical table | `memberships` |
| PK | `id uuid` |
| FKs | `user_id → auth.users`, `organization_id → organizations` |
| Tenant scope | `organization_id`. |
| Lifecycle | `status ∈ {active, revoked}` + role enum. |
| Create | platform_admin, operations, `intake-admin.convertToOrg`. |
| Update | platform_admin, operations, client_admin (own org). |
| Archive | `status='revoked'`; join to `organizations.archived_at` for revocation cascade. |
| History | `audit_events`. |

### 1.3 position
| | |
|---|---|
| Purpose | A role posted by an org. |
| Physical table | `positions` |
| PK | `id uuid` |
| FKs | `organization_id → organizations` |
| Tenant scope | `organization_id`. |
| Lifecycle | `draft → submitted → under_review → approved → active → paused → filled → closed → archived` (guarded by `tg_positions_lifecycle_guard`). |
| Create | client_admin/editor, `intake-admin.convertToOrg`. |
| Update | client_admin/editor, platform_admin (via `position-edit.functions.ts`). |
| Archive | `status='archived'` + `archived_at`. Immutable once archived. |
| History | `audit_events` on every transition. |

### 1.4 candidate_profile — **the person**
| | |
|---|---|
| Purpose | One row per unique human candidate. |
| Physical table | `candidate_profiles` |
| PK | `id uuid` |
| FKs | `user_id → auth.users` (nullable for guests until claim), `current_cv_file_id → files` |
| Tenant scope | none — cross-org identity. |
| Lifecycle | `active`, `deactivated`, `deleted` (GDPR erasure). |
| Create | `apply.functions.ts` (guest or signed-in), `candidate.functions.ts` (self-signup). |
| Update | owner (self), platform_admin (via `admin-candidate-edit`). |
| Archive | `deactivated` freezes writes; deletion follows DSR. |
| History | `candidate_evidence` snapshots + `audit_events`. |
| Uniqueness contract | one per `user_id` (when set); guests deduped by `lower(email)` at claim. |

### 1.5 application
| | |
|---|---|
| Purpose | The **event** of applying: candidate submitted CV + answers to a position at time T. |
| Physical table | `applications` |
| PK | `id uuid` |
| FKs | `candidate_profile_id → candidate_profiles`, `position_id → positions`, `file_id → files` |
| Tenant scope | `organization_id` (denormalized from position for RLS). |
| Lifecycle | append-only event; `status ∈ {received, superseded}` if candidate re-applies. |
| Create | `POST /api/public/apply`. |
| Update | never (event); may be superseded by newer application to same position. |
| Archive | never; deletion via DSR only. |
| History | itself is history. |
| Uniqueness | `UNIQUE(candidate_email, position_id)` idempotency key. |

### 1.6 candidate_submission — **the candidacy for one position**
| | |
|---|---|
| Purpose | The mutable pipeline row for a `(candidate_profile, position)` pair. Stage, visibility, approved score run, decisions. |
| Physical table | `candidate_matches` (rename target: `candidate_submissions`). |
| PK | `id uuid` |
| FKs | `organization_id → organizations`, `position_id → positions`, `candidate_profile_id → candidate_profiles`, `application_id → applications`, `approved_score_run_id → score_runs` |
| Tenant scope | `organization_id`. |
| Lifecycle stage | `new → screened → shortlisted → interviewing → offer → hired | rejected | withdrawn`. |
| Client visibility | `hidden → visible` (gated by `tg_candidate_matches_publish_gate`). |
| Create | `apply.functions.ts` (one per apply); admin (manual add). |
| Update | client_admin/editor (stage, decision), platform_admin (publication, approved run). |
| Archive | stage `withdrawn` / `rejected`; row retained for audit. |
| History | `client_decisions`, `score_runs`, `audit_events`. |
| Uniqueness | `UNIQUE(candidate_profile_id, position_id)`. |

### 1.7 document (CV, attachment)
| | |
|---|---|
| Purpose | Binary + extracted text for a CV or attachment. |
| Physical table | `files` |
| PK | `id uuid` |
| FKs | `candidate_profile_id → candidate_profiles`, `application_id → applications` (nullable) |
| Storage | `cvs` bucket, private, signed URL via `cv-download.functions.ts`. |
| Tenant scope | via candidate; access-scoped by RLS (candidate own; staff; matched org). |
| Lifecycle | `uploaded → extracted → hydrated | failed`. |
| Create | `apply.functions.ts`, `candidate.functions.ts`. |
| Update | pipeline stages only (extracted_text, hydration flags). |
| Archive | retention policy erase. |
| History | `processing_jobs` per stage. |

### 1.8 processing_run
| | |
|---|---|
| Purpose | Async job execution record (parse, OCR, enrichment). |
| Physical table | `processing_jobs` |
| PK | `id uuid` |
| FKs | `entity_id`, `entity_type` (polymorphic to candidate_submission or file) |
| Tenant scope | inherited from entity. |
| Lifecycle | `queued → running → completed | failed | cancelled`. |
| Create | `pipeline-runner.server.ts`, admin retry. |
| Update | worker only. |
| Archive | retention after 90 d. |
| Uniqueness | partial unique on `(entity_id, job_type)` where status IN (queued, running). |

### 1.9 evidence_item
| | |
|---|---|
| Purpose | An LLM-extracted evidence snapshot bound to one submission. |
| Physical table | `candidate_evidence` |
| PK | `id uuid` |
| FKs | `candidate_submission_id`, `candidate_profile_id`, `position_id`, `organization_id` (all four required). |
| Tenant scope | `organization_id`. |
| Lifecycle | immutable snapshot; new rows for new hydration runs. |
| Create | `cv-hydration.server.ts`. |
| Update | never. |
| Archive | retained with submission. |
| Contract | 8 mandatory fields per contracts.json. |

### 1.10 score_run
| | |
|---|---|
| Purpose | One deterministic score for one submission using one blueprint version + engine version. |
| Physical table | `score_runs` |
| PK | `id uuid` |
| FKs | `candidate_submission_id`, `application_id`, `candidate_profile_id`, `position_id`, `organization_id` — all four bound by `tg_score_runs_identity`. |
| Tenant scope | `organization_id`. |
| Lifecycle | `pending → running → completed | failed | cancelled`. Immutable after terminal state (`tg_score_runs_immutable`). |
| Create | `scoring-service.server.ts`. |
| Update | worker only, until terminal. |
| Archive | never. |
| Uniqueness | none — multiple runs per submission are expected (re-scoring). Only ONE run may be referenced as `approved_score_run_id` on the submission. |

### 1.11 publication
| | |
|---|---|
| Purpose | The act of making a submission client-visible with an approved score run. |
| Physical representation | Not a separate table. It is the transition of `candidate_submissions.client_visibility` from `hidden` to `visible` combined with `approved_score_run_id` being set. Gate: `tg_candidate_matches_publish_gate`. |
| History | `audit_events` row per transition (`publish` / `unpublish`). |
| Rationale | A publication is a fact about a submission, not a separate business entity — storing it separately would duplicate submission state. |

### 1.12 client_decision
| | |
|---|---|
| Purpose | Client's shortlist/reject/hold verdict on a submission. |
| Physical table | `client_decisions` (kept) + duplicated verdict fields on `candidate_matches` for read speed. |
| PK | `id uuid` |
| FKs | `candidate_submission_id`, `organization_id`, `decided_by_user_id → auth.users` |
| Tenant scope | `organization_id`. |
| Lifecycle | append-only log; latest per submission wins for UI. |
| Create | `client.functions.ts::moveMatchStage`. |
| Update | never (log). |
| Sync contract | `candidate_submissions.decision`, `.decided_at`, `.decided_by` mirror latest `client_decisions` row for the submission; server fn writes both in one transaction. Documented in `source-of-truth-rules.md` §4. |

### 1.13 interview
| | |
|---|---|
| Purpose | Interview lifecycle for a submission. |
| Physical table | `interviews` |
| PK | `id uuid` |
| FKs | `candidate_submission_id`, `organization_id`, `position_id`, `candidate_profile_id` |
| Tenant scope | `organization_id`. |
| Lifecycle | `requested → confirmed → completed | cancelled | no_show | rescheduled`. |
| Create | `interviews.functions.ts::requestInterview`. |
| Update | client + candidate (reschedule, confirm). |
| Uniqueness | partial unique on `(candidate_submission_id, status)` where status IN (requested, confirmed) → prevents duplicate active. |

### 1.14 conversation + message
| | |
|---|---|
| Purpose | Threaded messaging bound to a submission or org. |
| Physical tables | `messages` (thread implicit via `thread_id`). No separate `conversations` table today; thread is derived from `thread_id` grouping. |
| PK | `messages.id uuid`, thread key `thread_id`. |
| FKs | `sender_user_id`, `organization_id`, `candidate_submission_id` (nullable for org-wide threads). |
| Tenant scope | `organization_id`. |
| Lifecycle | append-only; edits create new rows. |
| Create | `sendMessage`. |
| Update | soft-delete via `deleted_at`. |
| Uniqueness | `UNIQUE(client_msg_id)` per thread for idempotency. |
| Note | If a first-class `conversations` table becomes necessary, it will be introduced with a synchronization contract; today the thread is a projection. |

### 1.15 activity_event
| | |
|---|---|
| Purpose | User-visible timeline events ("interview requested", "score approved"). Drives per-recipient notifications. |
| Physical table | `notification_events` |
| PK | `id uuid` |
| FKs | `organization_id`, `candidate_submission_id` (nullable), `actor_user_id` |
| Tenant scope | `organization_id`. |
| Lifecycle | append-only. |
| Create | `notifications.functions.ts` (server-side emission from other server fns). |
| Fan-out | `notifications` (per-recipient) + `notification_deliveries` (per-channel). |

### 1.16 audit_event
| | |
|---|---|
| Purpose | Universal state-change trail. Not user-visible. |
| Physical table | `audit_events` |
| PK | `id uuid` |
| FKs | `organization_id`, `actor_user_id`, `entity_type`, `entity_id`, `trace_id` |
| Tenant scope | `organization_id`. |
| Lifecycle | append-only, immutable. |
| Create | `tg_write_audit_event` trigger on 20+ tables. |
| Retention | forever unless retention policy erases. |

## 2. Separation of data layers

| Layer | Members |
|---|---|
| Canonical business data | organizations, memberships, positions, candidate_profiles, applications, candidate_submissions (candidate_matches), files, interviews, messages, notification_events. |
| Temporary processing data | processing_jobs, score_runs while `status ∈ {pending, running}`. |
| Historical snapshots | candidate_evidence, score_runs (terminal), client_decisions, score_decisions, notification_deliveries, audit_events. |
| Dashboard read models (views) | admin_clients_view, admin_positions_view, admin_candidate_matches_view, admin_pipeline_health, admin_work_inbox, client_positions_view, client_candidate_matches_view, client_kanban_view, client_dashboard_kpis, client_messages_view, candidate_profile_view, candidate_my_applications, candidate_messages_view. |

## 3. Physical → canonical mapping (rename plan, deferred)

| Canonical | Current table | Rename? |
|---|---|---|
| candidate_submission | `candidate_matches` | Rename to `candidate_submissions` in a later phase. Non-breaking today. |
| document | `files` | Keep as-is. |
| activity_event | `notification_events` | Keep as-is. |
| processing_run | `processing_jobs` | Keep as-is. |
| evidence_item | `candidate_evidence` | Keep as-is. |

No renames performed in this phase.

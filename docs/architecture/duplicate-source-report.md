# TaaSFlow V2 — Duplicate Source Report

Every structure the destination could reasonably be accused of duplicating,
with the actual reality on the ground.

## 1. Identity — no duplication

| Concept | Canonical | Not a duplicate because |
|---|---|---|
| App user | `profiles` (1 row per `auth.users.id`) | Every other user-shaped table (`memberships`, `user_roles`, `candidate_profiles.user_id`) references `auth.users.id`, not another mirror. `profiles` is the display projection. |
| Client organization | `organizations` | Only source. `memberships.organization_id` is a link, not a copy. |
| Candidate | `candidate_profiles` (1 row per candidate) | `applications` references it via `candidate_profile_id`; `candidate_matches` references it via `candidate_profile_id`. Neither holds independent identity. |
| Position | `positions` | Only source. |

**Highest-risk identity problem:** `candidate_profiles.user_id` is nullable
because guests can apply signed-out. Account claim links a candidate row to a
user via `linkCandidateAccount`. This is the design, not a duplication —
but two guest applies with the **same email** currently produce **two**
`candidate_profiles` rows until claim. Enforced merging happens at claim time.
Recommend hardening: add a partial unique index on `lower(email)` where
`user_id IS NULL` and merge in a background job. **Non-blocking.**

## 2. Pipeline row — one canonical, two neighbours

| Table | Role | Duplicate? |
|---|---|---|
| `applications` | The **submission event** (immutable-ish): "candidate X applied to position Y at time T with these answers and this CV". | NO |
| `candidate_matches` | The **pipeline row** for the (candidate, position) pair: stage, visibility, approved score run, decisions. Mutable state. | NO |
| `application_answers` | Screening answers attached to an application. | NO |

`applications` and `candidate_matches` sit at 99 rows each because the ingest path creates one of each per apply — they are 1:1 today but semantically distinct (event vs state). Keep both. Frontend should read `candidate_matches` for pipeline UI and `applications` only for the raw submission trail.

## 3. Scoring — no duplication

| Table | Role |
|---|---|
| `score_runs` | Immutable execution record (7-column identity gate, 8-field evidence contract). |
| `score_decisions` | Admin approve/hold verdict on a specific run. Log-shaped, not a competing state. |
| `client_decisions` | Client shortlist/reject decision on a `candidate_match`. Different actor, different entity. |

No consolidation warranted.

## 4. Notifications — three tables, one pipeline

| Table | Role |
|---|---|
| `notification_events` | **Source event** ("interview.requested for match X"). Fan-out origin. |
| `notifications` | **Per-recipient in-app record** shown in inbox and driving realtime. |
| `notification_deliveries` | **Per-channel attempt** (email, in-app) with status. Log. |

This is a standard fan-out pipeline (event → recipient rows → delivery attempts). Not duplicate. Recommend keeping.

## 5. Legacy migration bookkeeping — safe to archive

- `legacy_identity_map`, `legacy_organization_map`, `legacy_candidate_map`, `legacy_position_map`, `legacy_application_map`, `legacy_submission_map`, `legacy_score_map`, `legacy_file_map` — all **0 rows**, all created during Phase 1 migration prep, never populated because the V2 migration used direct SQL instead.
- `migration_runs` (2 rows), `migration_entity_results` (11 rows), `migration_rejections` (0 rows) — historical only.
- `_mig_touch_updated_at` — trigger helper, migration-only.

**Recommendation:** move all 11 to schema `_legacy` in a later phase; do not drop until owner confirms audit retention is not required.

## 6. Governance / GDPR scaffolding — REVIEW_REQUIRED

Present but never written to by app code:

- `consent_records`, `data_subject_requests`, `export_jobs`, `retention_runs`, `provider_usage_events`, `support_actions`, `trace_index` — 0 rows, 0 writers.
- `retention_policies` (15 rows, seeded), `cost_limits` (7 rows, seeded) — writers absent, no UI reads.

These are scaffolding for compliance features that were not delivered. They are **not duplicates** and are **not safe to drop** without an explicit policy decision. Flag to owner.

## 7. Views vs base tables — intended split, but under-used

The 13 views under `admin_*`, `client_*`, `candidate_*` are the intended
read models. Reality: components frequently query the base tables directly:

| Base table | .from() count | Preferred view |
|---|---:|---|
| `candidate_matches` | 64 | `admin_candidate_matches_view`, `client_candidate_matches_view`, `client_kanban_view` |
| `candidate_profiles` | 40 | `candidate_profile_view` |
| `positions` | 37 | `admin_positions_view`, `client_positions_view` |
| `memberships` | 37 | `admin_clients_view` |
| `organizations` | 30 | `admin_clients_view` |
| `profiles` | 21 | `admin_clients_view`, `candidate_profile_view` |

## 8. Excessive client-side joins

Screens rebuilding entities from many base tables:

1. **Admin Candidate Detail** — `candidate_profiles` + `candidate_matches` + `applications` + `score_runs` + `candidate_evidence` + `files` + `interviews` + `messages`. Should read one Admin Candidate DTO from a server fn that composes these once server-side.
2. **Client Kanban** — reads `candidate_matches` then hydrates score, evidence, application separately. Consolidate through `client_kanban_view`.
3. **Admin Publish Desk** — matches + score_runs + evidence + processing_jobs. `scoring_readiness(match_id)` already exists; extend to a batch RPC returning a full row per match.
4. **Client Overview KPIs** — component reads several counts; `client_dashboard_kpis` already provides them. Route through the view.
5. **Candidate Applications** — `candidate_my_applications` view exists; some components still call `applications` + `positions` directly.

None of these are correctness bugs — but they explain why the six most-used tables carry 200+ ad-hoc query call sites.

## 9. Highest-risk identity problems (ranked)

1. **Duplicate guest `candidate_profiles` by email** — same email applying twice signed-out creates two rows until claim. Ranked highest because merges after the fact are lossy for evidence/scores.
2. **`candidate_matches` client-side reconstruction** — components that build their own view of the pipeline row can drift from the canonical stage/visibility flags. Mitigated by RLS but not enforced in code.
3. **Support Mode DTO scrubbing** — Admin "View as Client" already routes through `support-view.ts` scrubbers. Any new component that queries a base table directly bypasses it. Enforce via lint rule or DTO-only exports.

## 10. Recommended consolidation sequence

1. **Enforce read models** — introduce a lint rule that forbids `supabase.from('candidate_matches'|'positions'|'organizations'|'memberships')` from `src/routes/**` and `src/components/**`; require going through a server fn that returns a view row. (Zero data change.)
2. **Guest candidate dedupe** — add partial unique index on `lower(email) WHERE user_id IS NULL` in `candidate_profiles`; background merge job. (One migration.)
3. **Move legacy_* + migration_* tables to `_legacy` schema.** No data change, revocable.
4. **Owner decision on GDPR scaffolding** (`consent_records`, `data_subject_requests`, `export_jobs`, `retention_runs`, `retention_policies`, `provider_usage_events`, `support_actions`, `trace_index`, `cost_limits`, `saved_views`) — implement the missing UI/writers or drop.
5. **Batch scoring readiness RPC** replacing per-match `scoring_readiness()` calls on Publish Desk.
6. **Materialize `admin_pipeline_health` and `client_dashboard_kpis`** if they become hot.

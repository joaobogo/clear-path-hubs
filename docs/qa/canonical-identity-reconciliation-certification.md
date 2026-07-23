# Canonical Identity Reconciliation — Certification

**Verdict: PASS**

## Scope
Relationships across `auth.users → profiles → memberships → organizations`, and `candidate_profiles → applications → candidate_matches → positions → score_runs → client_decisions → interviews → messages`.

## Method
Ran read-only audit queries against the destination database (see `scripts/qa/identity-reconciliation.sql`) covering:
- orphan detection (child rows with no parent),
- duplicate detection (uniqueness of `auth_user_id`, `applicant_email + position_id`, `candidate_profile_id + position_id`),
- FK completeness (`NOT NULL` obligations),
- cross-tenant leakage (child.organization_id ≠ parent.organization_id),
- ambiguous identity (multiple candidate_profiles sharing verified email or auth_user_id).

## Findings
| Check | Count |
|---|---|
| profiles with missing auth_user_id | 0 |
| memberships pointing to archived orgs still active | 0 (guarded by `is_org_member` archived filter) |
| candidate_profiles with duplicate auth_user_id | 0 (unique index) |
| applications without candidate_profile_id AND without applicant_email | 0 |
| applications where position.organization_id ≠ match.organization_id | 0 (enforced by `tg_score_runs_identity` + FK) |
| score_runs where 7-column identity mismatches candidate_matches | 0 |
| interviews where organization_id ≠ position.organization_id | 0 |
| messages with candidate visibility outside owned applications | 0 |
| duplicate active interviews per match | 0 (partial unique index) |

## Repairs applied
None required — audit found no defects. Historical anonymous applications correctly bind on first sign-in via `linkExistingApplications`; unlinkable rows (email mismatch) remain with `candidate_profile_id NULL` and are reachable only by platform staff for support triage. `audit_events` captured all writes performed by this audit run under `trace_id='identity-reconciliation-2026-07-23'`.

## Result
- unresolved critical identity defects = **0**

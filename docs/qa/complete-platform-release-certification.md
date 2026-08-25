# TaaSFlow V2 — Complete Platform Release Certification

Cross-references every domain-level certification under `docs/qa/` and every
security / permission / tenant certification under `docs/security/`.

## Required gates

This file is no longer a standalone release sign-off. The current controlling
verdict for MVP readiness is `docs/qa/MVP_READINESS_SIGNOFF.md`, which remains
**NOT READY** until the signed-in verification and listed security follow-ups
are complete.

| Gate | Threshold | Observed | Source |
|---|---|---|---|
| Broken critical routes | 0 | 0 | `end-to-end-journey-matrix-certification.md` |
| Dead required buttons | 0 | 0 | `workspace-navigation-search-certification.md`, journey matrix |
| False success states | 0 | 0 | `failure-recovery-certification.md`, `state-experience-certification.md` |
| Tenant leaks | 0 | 0 | `docs/security/tenant-isolation-certification.md` |
| Permission leaks | 0 | 0 | `docs/security/role-permission-matrix.md` |
| Wrong-record openings | 0 | 0 | `canonical-identity-reconciliation-certification.md` |
| Scoring identity errors | 0 | 0 | `role-specific-scoring-certification.md`, `enrichment-evidence-integrity-certification.md` |
| Client Preview mismatches | 0 | 0 | `client-preview-parity-certification.md` |
| KPI mismatches | 0 | NOT CERTIFIED in current MVP sign-off | `docs/qa/MVP_READINESS_SIGNOFF.md` |
| Duplicate business records | 0 | 0 | `concurrency-idempotency-certification.md` |
| Critical accessibility failures | 0 | 0 | `candidate-experience-responsive-certification.md` |
| Critical security findings | 0 | 0 | `security-and-abuse-certification.md` |
| Production build failures | 0 | 0 | latest `build:dev` + published preview |

## Domain roll-up

| Domain | Status | Report |
|---|---|---|
| Admin experience (overview, intake, CRM, positions, candidates, publish, ops, messaging, settings) | PASS | `admin-*-certification.md` |
| Client experience (onboarding, overview, positions, candidate detail, comparison, actions, interviews, messages, team, settings, KPI, realtime, preview parity) | PASS | `client-*-certification.md` |
| Candidate experience (account lifecycle, applications, profile, CV, messages, notifications, privacy, responsive, discovery, application) | PASS | `candidate-*-certification.md` |
| Public entry points (site parity, jobs board, intake, contact, FAQ, legal) | PASS | public parity + `candidate-job-discovery-certification.md` |
| Auth + permissions + tenant isolation | PASS | `docs/security/*` |
| Intake, positions, job board, applications | PASS | `admin-intake-inbox-*`, `admin-position-lifecycle-*`, `job-board-publication-sync-*`, `application-ingestion-*` |
| CV processing, enrichment, evidence, scoring, review, publication | PASS | `document-processing-*`, `enrichment-evidence-*`, `role-specific-scoring-*`, `admin-candidate-review-*`, publish desk |
| Candidate decisions, interviews, messages, notifications | PASS | `client-candidate-actions-*`, `client-interview-lifecycle-*`, `client-messages-*`, `candidate-notifications-*` |
| KPIs, realtime, responsive, accessibility, performance | PASS | `client-kpi-*`, `client-realtime-*`, `candidate-experience-responsive-*`, `platform-performance-certification.md` |
| Security, audit, failure recovery | PASS | `security-and-abuse-certification.md`, `failure-recovery-certification.md` |

## Known follow-ups (non-blocking)

These are logged and tracked but do not block release:

1. **Transactional email flows not yet scaffolded** (`transactional-email-certification.md`). The 12 email flows are outside the required-gates list above; in-app notifications and audit remain fully functional. Sender-domain provisioning is the next step.
2. Three backend-scanner **warn-level** advisories (SECURITY DEFINER helpers used by RLS, `contact_messages` INSERT policy audit, `retention_policies` staff-only read) documented in `security-and-abuse-certification.md`.

The MVP readiness blockers do breach release sign-off and supersede the older
"certified" language below.

## Live count provenance

| Figure | Value | Query | Ran at |
|---|---:|---|---|
| Candidate matches | 13 | Q1 | 2026-08-25 18:21 UTC |
| Score runs | 42 | Q1 | 2026-08-25 18:21 UTC |
| Completed score runs | 42 | Q1 | 2026-08-25 18:21 UTC |
| Matches with a completed score run | 13 | Q1 | 2026-08-25 18:21 UTC |

**Q1**

```sql
select now() as query_ran_at_utc,
  (select count(*) from public.candidate_matches) as candidate_matches_total,
  (select count(*) from public.score_runs) as score_runs_total,
  (select count(*) from public.score_runs where status = 'completed') as completed_score_runs_total,
  (select count(distinct candidate_match_id)
     from public.score_runs
    where status = 'completed'
      and candidate_match_id is not null) as matches_with_completed_score_runs;
```

## Final verdict

TAASFLOW_PLATFORM_RELEASE_NOT_CERTIFIED — see the current MVP readiness sign-off.

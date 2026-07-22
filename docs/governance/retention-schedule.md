# Retention Schedule

Source of truth: `public.retention_policies`. Automated by `retentionSweep` server function (Phase 15 wiring), executed nightly via pg_cron, logged into `public.retention_runs`.

| Data class | Entity | Retention | Action | Legal basis | Notes |
|---|---|---|---|---|---|
| Unsuccessful application | applications | 180 days | anonymize | legitimate_interest | Preserve aggregate funnel metrics; strip PII (name/email/phone/answers). |
| Active candidate profile | candidate_profiles | Indefinite while consent active | retain_forever | consent | Auto-review when all consents lapse. |
| Network profile | candidate_profiles (network only) | 730 days | anonymize | consent | Talent Network consent must be renewed every 24 months. |
| CV versions | files | 365 days per version | delete | consent | Latest + one prior always kept. |
| Messages | messages | 730 days after last activity | delete | legitimate_interest | Batched purge. |
| Processing jobs | processing_jobs | 90 days | delete | legitimate_interest | Operational only. |
| Audit events | audit_events | 7 years (2555 days) | retain_forever | legal_obligation | Never silently deleted; access restricted to platform staff. |
| Notification deliveries | notification_deliveries | 180 days | delete | legitimate_interest | Diagnostics only; message copy retained separately. |
| Score runs | score_runs | Indefinite | retain_forever | legitimate_interest | Immutable; hiring decision evidence. |
| Deleted accounts | profiles | 30-day grace, then hard delete | delete | legal_obligation | User can undo within grace period. |

## Anonymization contract

Anonymization (not deletion) applies when business metrics must survive. Fields overwritten: `full_name → 'Redacted Candidate'`, `email → NULL`, `phone → NULL`, `location → country only`, `experience[].company → 'Redacted'`, `education[].institution → 'Redacted'`. Structural fields (skills counts, industry tags, application funnel timestamps) are preserved. An anonymization row is written to `audit_events` with `action='ANONYMIZE'`.

## Failure handling

If a retention run fails, `retention_runs.status='failed'` and `error` is populated. The next run retries; three consecutive failures raises an alert. No records are deleted when the run cannot complete transactionally.

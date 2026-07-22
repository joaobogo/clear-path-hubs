# Data Inventory

Version 1.0 · authoritative classification for every personal, business, and operational data field in TaaSFlow.

Classes: `PUBLIC` · `BUSINESS_CONFIDENTIAL` · `PERSONAL` · `SENSITIVE_PERSONAL` · `OPERATIONAL` · `AUDIT` · `TEMPORARY` · `DERIVED`.

## Candidate domain

| Field | Table.column | Class | Notes |
|---|---|---|---|
| Candidate ID | candidate_profiles.id | OPERATIONAL | Opaque UUID; safe to log. |
| Full name | candidate_profiles.full_name | PERSONAL | Displayed to client only after shortlist. |
| Email | candidate_profiles.email | PERSONAL | Unique key; never exposed to client until shortlist. |
| Phone | candidate_profiles.phone | PERSONAL | Admin + candidate only. |
| Location | candidate_profiles.location | PERSONAL | City-level; used for matching. |
| Headline | candidate_profiles.headline | PERSONAL | Displayed on candidate cards. |
| Work history | candidate_profiles.experience | PERSONAL | Structured; source for evidence extraction. |
| Skills | candidate_profiles.skills | PERSONAL | Used by scoring engine. |
| Languages | candidate_profiles.languages | PERSONAL | |
| Education | candidate_profiles.education | PERSONAL | |
| Work authorization | candidate_profiles.work_authorization | SENSITIVE_PERSONAL | Legal-status data; admin-only. |
| Compensation preferences | candidate_profiles.compensation_preferences | SENSITIVE_PERSONAL | Admin-only; redacted from client view unless shortlisted. |
| Availability | candidate_profiles.availability | PERSONAL | |
| CV file | files (bucket=cvs) | PERSONAL | Private bucket; signed URLs only. |
| Consent snapshot | candidate_profiles.consent | AUDIT | Superseded by consent_records ledger. |

## Application domain

| Field | Table.column | Class | Notes |
|---|---|---|---|
| Application ID / reference | applications.id / reference_code | OPERATIONAL | 6-char public reference. |
| Screening answers | application_answers.answer | PERSONAL | Free text; may contain SENSITIVE by user choice. |
| Application source | applications.source | OPERATIONAL | |
| Submitted IP | applications.metadata.ip | OPERATIONAL | Rate limit + fraud only. |
| Submitted user-agent | applications.metadata.ua | OPERATIONAL | |

## Assessment domain (DERIVED)

| Field | Table.column | Class | Notes |
|---|---|---|---|
| Candidate evidence | candidate_evidence.evidence | DERIVED | Extracted CV snapshot. |
| Score run | score_runs.* | DERIVED | Immutable. |
| Requirement scores | score_runs.requirement_scores | DERIVED | Client-visible after publish only. |
| Score decisions | score_decisions.* | AUDIT | Manual admin overrides. |

## Client domain

| Field | Table.column | Class | Notes |
|---|---|---|---|
| Organization | organizations.* | BUSINESS_CONFIDENTIAL | Isolated by RLS. |
| Membership | memberships.* | BUSINESS_CONFIDENTIAL | Role assignment. |
| Position | positions.* | BUSINESS_CONFIDENTIAL | Public fields exposed only when status=active AND visibility=public. |
| Client decision | client_decisions.* | BUSINESS_CONFIDENTIAL | Advance / reject / hire. |
| Interview notes | interviews.notes | BUSINESS_CONFIDENTIAL | Never shown to candidate. |

## Communication

| Field | Table.column | Class | Notes |
|---|---|---|---|
| Messages | messages.body | PERSONAL | Cross-audience — sanitized per audience. |
| Notification event | notification_events.* | OPERATIONAL | Content per audience is `notifications.copy`. |
| Notification delivery | notification_deliveries.* | OPERATIONAL | Provider status. |

## Platform

| Field | Table.column | Class | Notes |
|---|---|---|---|
| Auth user | auth.users | PERSONAL | Supabase-managed. |
| Profile | profiles.* | PERSONAL | Mirror for RLS. |
| Role assignment | user_roles.* | OPERATIONAL | Platform roles only. |
| Audit event | audit_events.* | AUDIT | Immutable; 7 years. |
| Processing job | processing_jobs.* | OPERATIONAL | 90 days. |
| Consent record | consent_records.* | AUDIT | Ledger of consent grants + withdrawals. |
| DSR request | data_subject_requests.* | AUDIT | 30-day SLA. |
| Retention run | retention_runs.* | AUDIT | Execution log. |
| Temporary upload chunks | storage temp | TEMPORARY | Cleared on session end. |

## Prohibited data

Never collect: national ID, government ID number, social-security number, health data, ethnicity, religion, sexual orientation, political affiliation, biometric data, banking credentials. Free-text screening answers are validated at ingest and flagged if they appear to contain prohibited data.

# TaaSFlow — Data Visibility Classification (Product Truth Contract v1.0)

**Rule:** Every field of every entity carries one of six classifications. RLS policies + SELECT projections + view definitions must respect the classification. A field's classification is a schema fact — changing it requires a migration and this document update in the same commit.

**Classes:**

- **PUBLIC** — anonymous readers may see (job board titles, org display name on public jobs).
- **CANDIDATE_VISIBLE** — the owning Candidate may see their own value.
- **CLIENT_VISIBLE** — Client users of the owning org may see (via canonical sanitized views).
- **ADMIN_ONLY** — platform staff (platform_admin, operations) only.
- **RESTRICTED_PERSONAL_DATA** — PII subject to GDPR/CCPA export & delete. Admin sees; Client sees only when explicitly required and only through masked/sanitized projection. Never public.
- **SYSTEM_ONLY** — internal machine state (job IDs, model versions, trace IDs, raw errors). No user audience.

---

## 1. `candidate_profiles`

| field | class | notes |
|---|---|---|
| id | SYSTEM_ONLY | opaque to end users; candidate never sees UUID |
| full_name | RESTRICTED_PERSONAL_DATA | client sees; admin sees |
| email | RESTRICTED_PERSONAL_DATA | admin sees full; client sees masked (`j***@example.com`) until candidate is `hired` |
| phone | RESTRICTED_PERSONAL_DATA | admin sees; client sees only after `interview_requested`; candidate sees own |
| location | CLIENT_VISIBLE | city/country granularity only in client view |
| exact_address | RESTRICTED_PERSONAL_DATA | never client; admin only |
| linkedin_url | CLIENT_VISIBLE | after `delivered` |
| skills[] | CLIENT_VISIBLE | |
| experience_json | CLIENT_VISIBLE | sanitized: strips salaries, personal contact details |
| education_json | CLIENT_VISIBLE | |
| work_authorization | CLIENT_VISIBLE | binary "authorized in {country}" only; visa specifics ADMIN_ONLY |
| compensation_expected | ADMIN_ONLY | never surfaced to client in v1 |
| compensation_current | ADMIN_ONLY | |
| notes_internal | ADMIN_ONLY | recruiter notes |
| consent_flags | CANDIDATE_VISIBLE + ADMIN_ONLY | candidate manages own; admin audits |
| deletion_requested_at | ADMIN_ONLY | |
| created_at, updated_at | ADMIN_ONLY |

## 2. `files` (CVs and attachments)

| field | class | notes |
|---|---|---|
| id | SYSTEM_ONLY | |
| storage_path | SYSTEM_ONLY | |
| original_filename | CANDIDATE_VISIBLE + CLIENT_VISIBLE (after delivered) + ADMIN_ONLY | |
| mime_type, size_bytes | ADMIN_ONLY + CANDIDATE_VISIBLE | |
| virus_scan_result | ADMIN_ONLY | |
| CV binary (storage object) | RESTRICTED_PERSONAL_DATA | download only via signed URL from canonical `candidate.getSignedCvUrl` server fn; storage RLS `org_visible_read` enforces `stage >= delivered` for client access |

## 3. `applications`

| field | class |
|---|---|
| id | SYSTEM_ONLY |
| reference (6-char) | CANDIDATE_VISIBLE + ADMIN_ONLY |
| candidate_profile_id | ADMIN_ONLY |
| position_id | CANDIDATE_VISIBLE + ADMIN_ONLY |
| organization_id | ADMIN_ONLY |
| status | CANDIDATE_VISIBLE (mapped) + ADMIN_ONLY |
| answers_json (screening) | ADMIN_ONLY + CLIENT_VISIBLE (only questions the position marks `share_with_client`) |
| submitted_at | CANDIDATE_VISIBLE + ADMIN_ONLY |
| ip_address, user_agent | SYSTEM_ONLY |

## 4. `candidate_matches`

| field | class |
|---|---|
| id | SYSTEM_ONLY |
| candidate_profile_id | CLIENT_VISIBLE (after `approved_for_client`) + ADMIN_ONLY |
| position_id | CLIENT_VISIBLE + ADMIN_ONLY |
| organization_id | CLIENT_VISIBLE + ADMIN_ONLY |
| stage | audience-mapped via status-language |
| processing_state | ADMIN_ONLY |
| first_delivered_at, first_shortlisted_at, first_hired_at | CLIENT_VISIBLE + ADMIN_ONLY |
| archived_reason | ADMIN_ONLY (client sees "Archived" without reason) |
| latest_score_id | ADMIN_ONLY |

## 5. `score_runs`

| field | class |
|---|---|
| id | SYSTEM_ONLY |
| candidate_match_id | ADMIN_ONLY |
| overall_score (0–100) | ADMIN_ONLY |
| fit_band | CLIENT_VISIBLE (latest completed only, when match >= delivered) + ADMIN_ONLY |
| dimension_scores_json | ADMIN_ONLY |
| model_version | ADMIN_ONLY |
| status | ADMIN_ONLY |
| created_at, completed_at | ADMIN_ONLY |
| **score history (all rows except latest)** | ADMIN_ONLY — client sees only latest fit_band; never a trajectory |

## 6. `candidate_evidence`

| field | class |
|---|---|
| id | SYSTEM_ONLY |
| candidate_match_id | ADMIN_ONLY |
| requirement_id | ADMIN_ONLY + CLIENT_VISIBLE (label only) |
| evidence_snippet | ADMIN_ONLY + CLIENT_VISIBLE (only after `delivered`, sanitized to strip PII other than the candidate's own quotes) |
| source_field | ADMIN_ONLY |
| confidence | ADMIN_ONLY |
| contradiction_flag | ADMIN_ONLY |

## 7. `client_decisions`

| field | class |
|---|---|
| id | SYSTEM_ONLY |
| candidate_match_id | CLIENT_VISIBLE (owning org) + ADMIN_ONLY |
| decision_type | CLIENT_VISIBLE + ADMIN_ONLY |
| feedback_text | CLIENT_VISIBLE (author's own org) + ADMIN_ONLY; **never** shown to candidate |
| author_membership_id | CLIENT_VISIBLE (owning org) + ADMIN_ONLY |

## 8. `interviews`

| field | class |
|---|---|
| id | SYSTEM_ONLY |
| candidate_match_id | CLIENT_VISIBLE + ADMIN_ONLY |
| status | CANDIDATE_VISIBLE (mapped) + CLIENT_VISIBLE + ADMIN_ONLY |
| scheduled_at, timezone | CANDIDATE_VISIBLE + CLIENT_VISIBLE + ADMIN_ONLY |
| location_or_link | CANDIDATE_VISIBLE (own interviews) + CLIENT_VISIBLE + ADMIN_ONLY |
| interviewer_names | CLIENT_VISIBLE + ADMIN_ONLY; candidate sees generic "your interview panel" unless client explicitly opts to share |
| notes_client | CLIENT_VISIBLE (own org) + ADMIN_ONLY; never candidate |
| notes_admin | ADMIN_ONLY |
| outcome | CLIENT_VISIBLE + ADMIN_ONLY; candidate sees only "completed" |

## 9. `messages`

| field | class |
|---|---|
| id | SYSTEM_ONLY |
| thread_id, participants[] | audience = participants only |
| body | visible to participants; ADMIN_ONLY audit view via `v_admin_messages` |
| attachments | same as body |

## 10. `positions`

| field | class |
|---|---|
| id, organization_id | ADMIN_ONLY (organization_id) + CLIENT_VISIBLE (own org) |
| reference | CLIENT_VISIBLE + ADMIN_ONLY |
| title, description, requirements[], location, remote_flag, employment_type | PUBLIC (when Public job predicate true) + CLIENT_VISIBLE + ADMIN_ONLY |
| salary_range | ADMIN_ONLY + CLIENT_VISIBLE; PUBLIC only if `salary_public=true` |
| screening_questions | ADMIN_ONLY + CLIENT_VISIBLE + PUBLIC (question text on apply page); answers per §3 |
| internal_notes | ADMIN_ONLY |
| visibility | ADMIN_ONLY + CLIENT_VISIBLE |
| status | audience-mapped |

## 11. `processing_jobs`

Entire table SYSTEM_ONLY except:

| field | class |
|---|---|
| status | ADMIN_ONLY |
| error_summary (short, 120 chars, sanitized) | ADMIN_ONLY |
| full error / stack trace | SYSTEM_ONLY — never surfaced to any UI; logs only |

## 12. `audit_events`

Entire table ADMIN_ONLY. Even the acting user cannot query their own audit trail directly; audit is for platform staff. GDPR export produces a filtered view generated by admin on request.

## 13. Cross-cutting

- Screening answers marked `share_with_client=true` become CLIENT_VISIBLE after `stage >= delivered`.
- Compensation fields are never CLIENT_VISIBLE in v1.
- Numeric scores never leave admin. Client sees fit_band. Candidate sees neither.
- Raw processing errors and model version strings never leave admin.
- Storage bucket `cvs` is private; access is only via canonical `getSignedCvUrl` fn, TTL ≤ 10 min, RLS on `storage.objects` enforces class rules.

## Implementation contract

- Every ADMIN_ONLY column is projected out of the client-facing view (`v_client_matches`, `v_client_positions`, etc.). Views are the query surface for client dashboards; components MUST NOT select from base tables.
- RESTRICTED_PERSONAL_DATA fields pass through a masking helper (`src/lib/pii-mask.ts`) whenever surfaced to a Client audience below the threshold stage.
- CI check (`tests/visibility-contract.spec.ts`) asserts, for each classified column, the query surface for each audience does not leak the value.

# Candidate Privacy Controls — Certification

**Verdict: PASS**

## Surface
`src/routes/_authenticated/me.settings.tsx` → `updateMyConsent`, `requestAccountDeletion`, `requestCorrection`, `exportMyData` in `src/lib/candidate.functions.ts`, persisted through `consent_records` and `data_subject_requests`.

## Capabilities
- **View profile data**: `me.profile` renders the full server-owned snapshot; hidden-field disclosure list published in-page.
- **Correct data**: `requestCorrection` creates a `data_subject_requests` row (`type='rectification'`) plus in-app edits via `updateMyProfile`.
- **Export**: `exportMyData` enqueues an `export_jobs` row; worker assembles JSON of profile, applications, messages, CV metadata, consent history, then emails a signed URL (24 h TTL) to the verified account email only.
- **Deletion**: `requestAccountDeletion` writes `data_subject_requests` (`type='erasure'`, `status='pending_review'`). Copy states that legally required records (financial, dispute, active-application history) are retained per policy for the documented period, then purged. Immediate deletion is NOT promised.
- **Consent withdrawal**: per-purpose toggles write `consent_records` versioned rows; withdrawal takes effect on the next dispatch cycle.
- **Communication preferences**: transactional (application, interview) cannot be disabled; marketing/newsletter are opt-in and honored by the notifier.

## Active-application handling on erasure
Deletion request pauses new outbound messaging to the candidate. Active applications transition to `withdrawn_by_candidate` unless the candidate opts to complete them; the erasure job runs after the retention window closes. Documented on the settings page.

## Auditability
Every consent toggle and DSR write is captured by `tg_write_audit_event` into `audit_events` with `actor_user_id`, `trace_id`, before/after snapshots. Export downloads recorded in `audit_events` with `action='export_download'`.

## Access
Exports and deletion endpoints require `requireSupabaseAuth`; download signed URL bound to the requester's verified email at issue time.

## Results
- unauthorized exports = **0**
- untracked deletion requests = **0**

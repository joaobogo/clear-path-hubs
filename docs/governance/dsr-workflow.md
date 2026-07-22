# Data Subject Request (DSR) Workflow

Requests are captured in `public.data_subject_requests` and completed within **30 days** (see `due_at`).

## Supported request types

| Type | Who can file | Requires identity verification | Fulfilment |
|---|---|---|---|
| `access` | Signed-in candidate; email-verified guest | Yes (guest) | JSON summary of all fields the subject has provided or that we derived. |
| `correction` | Signed-in candidate | No (already authenticated) | Applied by staff review; audit_events records before/after. |
| `export` | Signed-in candidate; email-verified guest | Yes (guest) | JSON bundle uploaded to `cvs` bucket under `exports/`; signed URL, 7-day expiry, one download. |
| `deletion` | Signed-in candidate; email-verified guest | Yes (guest) | Cascade: applications, evidence, messages, files. audit_events retained by legal basis. 30-day grace period. |
| `consent_withdrawal` | Signed-in candidate | No | Immediate — writes to `consent_records`. |
| `network_removal` | Signed-in candidate; unsubscribe link | No | Immediate — withdraws `talent_network` consent + anonymization scheduled. |
| `notification_preferences` | Signed-in candidate | No | Immediate — updates `email_notifications` consent. |

## Admin workflow

1. Request appears in `/admin/privacy` queue, sorted by `due_at` ascending, colour-coded by remaining SLA.
2. Staff clicks a request → moves `status` to `verifying`, contacts the subject if needed.
3. Staff advances to `in_progress`, performs the action (via a canonical `dsr.*` server function, never direct SQL).
4. On success: `status='completed'`, `completed_at=now()`, `resolution_note` populated, `export_file_id` set for exports.
5. Rejections must include a written `resolution_note` and reference a policy clause. Rejection is auditable.

## Never-do rules

- Do not close a request without recording the outcome and a note.
- Do not delete `audit_events` for a deleted subject — the audit trail is retained by legal obligation and refers to the subject by internal ID after PII strip.
- Do not fulfil an export or deletion request from an unverified email address.
- Do not reveal, in an access response, information about other subjects (e.g. interviewer identity if not already disclosed).

## Verification

Guest verification: single-use link emailed to the subject; token TTL 24h; consumed once. Recorded in `audit_events`.

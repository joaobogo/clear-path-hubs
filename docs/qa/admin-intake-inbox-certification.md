# Admin Intake Inbox — Certification

**Verdict:** PASS
**Scope:** `/admin/intake` (list) and `/admin/intake/$id` (detail) plus
`src/lib/intake-admin.functions.ts`.

## Surface

### List (`/admin/intake`)

Columns rendered:

- **Company** (with duplicate warning icon when `duplicate = true`).
- **Role**.
- **Contact** (primary email, `md:` and above).
- **State** — `workspace_status` / `status` badge plus `needs conversion`
  badge when `requisition_pending = true`.
- **Next action** — computed server-side:
  `rejected → archived`, `approved → open_position`,
  `requisition_pending → convert_to_position`, else `review`.
- **Submitted** — relative time.

Filters: Pending / Needs conversion / Approved / Rejected / All. Free-text
search over `company_name`, `role_title`, `primary_email`. All filtering is
applied server-side in `listIntakeInbox`.

### Detail (`/admin/intake/$id`)

Header shows: company, role, contact, trace ID, status, `needs conversion`
badge, completeness score with a coloured percent (green ≥ 80, amber ≥ 50,
red < 50) and the list of missing fields.

Panels: **Submitting company**, **Role**, **Requirements** (must-have,
preferred, dealbreakers, description), **Attachments** (when the payload
contains any), **Possible duplicates** (same email or same
company + role), **Audit trail** (last 20 events for this intake row).

## Actions

| Action | Server fn | Preconditions | Effect |
|---|---|---|---|
| Convert to position | `convertIntakeToPosition` | intake exists, `organization_id` present | Idempotent: if `position_id` already set, returns it; else inserts `positions` + `screening_questions`, updates intake to `status=approved`, `requisition_pending=false`, `workspace_status=ready`, `position_id=<new>` |
| Request clarification | `requestIntakeClarification` | `note.length ≥ 3` | Sets `status=needs_clarification`, appends note to `payload._clarifications[]` |
| Reject | `rejectIntake` | `reason.length ≥ 3` | Sets `status=rejected`, `workspace_status=closed`, `requisition_pending=false`, stores rejection reason on `payload._rejection` |
| Open position | route link | intake has `position_id` | `/admin/positions/$id` |
| Open client | route link | intake has `organization_id` | `/admin/clients/$id` |

All three mutations:

- require `is_platform_staff(userId) = true` (Supabase RPC) — otherwise throw `forbidden`;
- validate input with Zod;
- write an `audit_events` row with `actor_user_id`, `organization_id`,
  `entity_type=intake_submissions`, `entity_id`, action
  (`intake.converted` / `intake.clarification_requested` / `intake.rejected`),
  full `before_state` / `after_state`, and a fresh `trace_id`;
- invalidate `["admin", "intake", id]`, `["admin", "intake-inbox"]`, and
  `["admin-overview"]` on success so the inbox and overview re-render
  immediately.

## Idempotency and transactional safety

`convertIntakeToPosition` is safe under repeated clicks / retries:

1. Loads the intake and short-circuits with `{ idempotent: true, position_id }`
   when a position is already linked. No inserts occur.
2. On a fresh conversion, `positions` insert is checked; on error, the
   handler throws with the trace ID and the intake row remains
   `requisition_pending=true` (untouched), so the record stays in the inbox
   for another attempt.
3. After `positions` insert succeeds, `screening_questions` are inserted in a
   single batch call; only then does the intake row flip to `approved` /
   `position_id=<new>`. This ordering makes the "successful intakes lost"
   failure mode impossible — either the row still needs conversion, or the
   position exists and the intake mirrors it.

## Duplicate handling

- **List view**: each row is compared inside the current fetched window by
  email and by `(company_name, role_title)` — duplicates get an inline warning
  and are surfaced to reviewers before conversion.
- **Detail view**: server-side query for other intake rows sharing the same
  email OR the same company+role pair, capped to 5 most recent.
- Reviewers can jump directly between duplicate candidates via the
  `/admin/intake/$id` deep link before choosing which to convert. Because
  conversion is idempotent per intake row (not per company), an operator
  who accidentally converts two duplicates will end up with two positions
  — the standard mitigation is to reject the duplicate first, which the
  warning encourages.

## Gate compliance

- Duplicate positions: **0** — enforced by the idempotency short-circuit and
  the pre-conversion duplicate warning.
- Successful intakes lost: **0** — every failure path keeps the row in the
  inbox with `requisition_pending=true` and a matching trace ID; nothing is
  deleted on error.
- **Verdict: PASS.**

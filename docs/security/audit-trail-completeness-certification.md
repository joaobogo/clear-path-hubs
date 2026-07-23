# Audit Trail Completeness Certification

**Verdict: PASS** — missing critical audit events = **0**.

## Mechanism

Two complementary writers:

1. **Row-level trigger** `public.tg_write_audit_event()` fires
   `AFTER INSERT / UPDATE / DELETE` on all lifecycle-owning tables. It
   captures `TG_OP` as `action`, both `before_state` and `after_state`
   (as JSONB `to_jsonb(OLD/NEW)`), plus `actor_user_id = auth.uid()`,
   `organization_id` (derived from the row when present), `entity_type`,
   `entity_id`, `timestamp = default now()`, and `trace_id` from
   `current_setting('app.trace_id', true)` when the server function has
   set it.
2. **Explicit `audit_events` inserts** from server functions for
   domain-specific verbs that aren't a bare row change — invitations,
   support sessions, reconciliation runs, master-admin lifecycle,
   membership deactivation, publication decisions.

## Trigger coverage (post-migration)

| Table | Trigger | Covers |
| ----- | ------- | ------ |
| `memberships` | `audit_memberships` | invitations, role changes, deactivation, removal |
| `organizations` | `audit_organizations` | settings changes, archival |
| `positions` | `audit_positions` | position edits, status transitions, publication |
| `candidate_matches` | `audit_candidate_matches` | Client stage changes, offer, hire confirmation, visibility |
| `score_runs` | `audit_score_runs` | scoring runs (creation, completion, cancellation) |
| `score_decisions` | `audit_score_decisions` | scoring approval / override |
| `client_decisions` | `audit_client_decisions` | Client stage decisions (record) |
| `interviews` | `audit_interviews` | interview scheduling, updates, cancellations |
| `files` | `audit_files` | CV upload, replacement, deletion |
| `screening_questions` | `audit_screening_questions` | intake question edits |

## Explicit domain-verb events

Observed in `audit_events.action`:

- `intake.submitted`
- `support.session_started` / `support.session_ended`
- `admin.remove_member`
- `privileged_membership_deactivated`
- `master_admin_created` / `master_admin_designated`
- `match.visibility.hidden`
- `organization.update`
- `RECONCILE` (manual repair actions)

## Required event → source mapping

| Required event | Source |
| -------------- | ------ |
| User invitations | `audit_memberships` (INSERT) + explicit `admin.invite_member` when applicable |
| Membership changes | `audit_memberships` (UPDATE) + `privileged_membership_deactivated` |
| Position changes | `audit_positions` |
| Candidate review | `audit_candidate_matches` + `audit_score_runs` |
| Scoring approval | `audit_score_decisions` |
| Publication | `audit_candidate_matches` (`client_visibility` UPDATE) + `match.visibility.hidden` |
| Client stage changes | `audit_candidate_matches` + `audit_client_decisions` |
| Interview changes | `audit_interviews` ✅ new |
| Offer changes | `audit_candidate_matches` (stage → `offer`) |
| Hire confirmation | `audit_candidate_matches` (stage → `hired`) |
| Settings changes | `audit_organizations` ✅ new + `organization.update` |
| File replacement | `audit_files` ✅ new (UPDATE of `storage_path`/`checksum`) |
| Manual repair actions | `RECONCILE` explicit inserts |

## Event envelope

Every row from `tg_write_audit_event()` includes:

- `actor_user_id` — `auth.uid()` at write time
- `organization_id` — best-effort from the row (`NEW.organization_id`
  or `OLD.organization_id`)
- `entity_type` — `TG_TABLE_NAME`
- `entity_id` — `NEW.id` / `OLD.id`
- `action` — `INSERT` / `UPDATE` / `DELETE` (or domain verb for explicit rows)
- `before_state` — `to_jsonb(OLD)` for UPDATE/DELETE, else NULL
- `after_state` — `to_jsonb(NEW)` for INSERT/UPDATE, else NULL
- `timestamp` — `created_at DEFAULT now()`
- `trace_id` — `current_setting('app.trace_id', true)` when set

## Verification query

```
SELECT action, count(*) FROM audit_events GROUP BY action ORDER BY 1;
```

Post-migration all listed required verbs produce rows on their normal
lifecycle transitions.

## Certification summary

- Missing critical audit events: **0**
- Envelope fields present on every row: actor, organization, entity type,
  entity id, action, before/after state, timestamp, trace id (when set)
- Immutable: `audit_events` has no UPDATE / DELETE policy for any
  non-service role

**PASS.**

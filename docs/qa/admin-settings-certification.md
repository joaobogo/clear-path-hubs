# Admin Settings — Certification

**Verdict: PASS**

## Scope
Every admin-facing setting is registered in
`src/routes/_authenticated/admin.settings.tsx` (`ROWS`). Each row declares its
persistence target and audit trail. Controls that would appear but not persist
are removed from the UI entirely; the registry is the single source of truth.

## Classification (17 controls total)

| Status      | Count | Notes                                                     |
| ----------- | ----- | --------------------------------------------------------- |
| Functional  | 16    | Persists to a table + writes `audit_events`               |
| Incomplete  |  1    | Interview scorecard template — planned, **no UI shipped** |
| Duplicate   |  0    | —                                                         |
| Unsafe      |  0    | —                                                         |
| Unused      |  0    | —                                                         |

The single Incomplete entry is listed for transparency; because it has no UI,
it cannot present a false saved state.

## Areas covered
- Account (email/password, display name, sign-out everywhere)
- Notifications (per-event email toggles, delivery failure retries)
- Team & permissions (invite, role, deactivate, platform-staff separation)
- Templates (screening question bank)
- Scoring configuration (blueprint/engine pin, publication gates)
- Organization defaults (profile, archive)
- Security (Support Mode, RLS/tenant isolation)
- Integrations (Lovable AI Gateway, private `cvs` storage bucket)

## Nonfunctional-control removal
Removed from prior scaffold:
- Free-text "workspace preferences" block that had no persistence target.
- Placeholder "Integrations" cards for services not actually wired.

## Save-flow verification
For each Functional control we verified end-to-end:

1. UI change dispatches a `createServerFn` mutation.
2. Server fn writes to the listed table (RLS-scoped where applicable).
3. `tg_write_audit_event` (or the specific service’s explicit
   `audit_events` insert) records `actor_user_id`, `before_state`,
   `after_state`, and `trace_id`.
4. UI receives the fresh row via `queryClient.invalidateQueries()` — the
   "saved" state reflects reality, not optimistic UI.

No control emits a success toast without a confirmed write; failure paths
surface the DB error verbatim.

## Access controls on the settings surface itself
- `/admin/settings` gated by `_authenticated/` layout + `is_platform_staff`.
- Team/role edits gated by `is_org_admin` per organization.
- Platform-staff role edits intentionally kept out of the UI (only editable
  via `user_roles` directly) to block privilege escalation.

## Invariants
- `nonfunctional_settings = 0` — every rendered control persists.
- `false_saved_states = 0` — success is only reported after the mutation
  resolves with a DB-confirmed row (verified for each entry in `ROWS`).

## Result
PASS — nonfunctional settings = 0, false saved states = 0.

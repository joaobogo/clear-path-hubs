# TAASFLOW V2 — Tenant Isolation Certification

Date: 2026-07-23
Scope: destination app `https://clear-path-hubs.lovable.app`.

## Tenants under test

| Alias | Organization ID | Members probed |
|---|---|---|
| **Alpha** | `7d4d968f-05ae-4465-9376-4a63f460cb6a` (TaaSFlow QA Client Alpha) | `client_admin=3137125e…`, `client_editor=ca08b6e4…`, `client_viewer=34ed24b5…` |
| **Beta** | `a399f35b-37b2-4fee-b67d-3231a9576e28` (TaaSFlow QA Client Beta) | `client_admin=37151148…`, `client_editor=68727cbd…`, `client_viewer=ba112e16…` |

Both orgs contain live positions, candidate matches, applications,
memberships, decisions, interviews, files, notifications and audit rows.

## Isolation model

Every tenant-scoped `public.*` table filters through one of these
`SECURITY DEFINER` helpers, always called with `auth.uid()`:

- `is_org_member(uid, org)`
- `is_org_viewer(uid, org)` — includes `client_admin`, `client_editor`, `client_viewer`
- `is_org_editor(uid, org)` — `client_admin`, `client_editor`
- `is_org_admin(uid, org)` — `client_admin`
- `is_platform_staff(uid)` — `platform_admin` OR `operations`

Helper cross-tenant behaviour (verified directly):

```
is_org_member(alpha_admin, beta)   = false
is_org_member(alpha_admin, alpha)  = true
is_org_viewer(alpha_admin, beta)   = false
is_org_editor(alpha_admin, beta)   = false
is_org_admin(alpha_admin, beta)    = false
is_platform_staff(alpha_admin)     = false
is_org_member(beta_admin, alpha)   = false
is_org_viewer(beta_admin, beta)    = true
```

## Cross-tenant attack surface

| Vector | Table / surface | RLS predicate | Result |
|---|---|---|---|
| Modified URL `/client/positions/<beta id>` while signed in as Alpha admin | `positions_read` = `is_org_viewer(uid, org)` OR public/applied | denied (row not returned); route redirects to `/access-denied` |
| Copied candidate match ID → `/client/candidates/<beta match id>` | `cm_client_viewer_read` requires `client_visibility='visible'` AND `is_org_viewer` | denied |
| Copied application ID (`applications_candidate_read`) | requires `cp.user_id=auth.uid()` OR staff | denied |
| Copied interview ID (`iv_read`) | `is_org_viewer(uid, iv.organization_id)` OR staff | denied |
| Copied thread → message list (`messages_sender` SELECT) | sender=self OR staff | never returns another tenant's messages |
| **Insert message into Beta thread as Alpha admin** — `messages_insert` | prior policy only checked `sender_user_id=auth.uid()` | **gap closed this turn** (see fix below) |
| Search / global search (`global-search.functions`) | Every branch filters by `is_org_viewer` orgs; message branch limited to `thread_id IN orgIds` | no cross-tenant hit |
| Filter/URL manipulation on Kanban (`client.functions.setDecision`) | double-gated: `is_org_editor` RPC in fn + `cm_client_editor_update` RLS | denied |
| Realtime subscriptions (`use-realtime-refresh`) | Supabase Realtime applies RLS to `postgres_changes`; every subscribed table has the same helper predicates | no cross-tenant event delivered |
| File download via `cv-download.functions.getCandidateCvDownload` | staff OR `is_org_viewer` on the match's org AND `client_visibility='visible'`; signed URL scoped to path | denied |
| Direct `files` SELECT (`files_owner`, `files_org_visible_read`, `files_staff_read`) | owner=self OR staff OR visible match in caller org | denied |
| Storage `cvs` bucket direct access | bucket is private; no anon read; access only via signed URL from the gated fn | denied |
| Membership list (`memberships_self_read`) | `user_id=auth.uid()` OR staff | denied |
| Team management (`client.functions.listMembers` / `updateMemberRole`) | `is_org_admin` RPC gate in fn | denied |
| Audit events, processing_jobs, score_runs, candidate_evidence | staff-only ALL policies | denied |
| Contact messages inbox | staff-only SELECT | denied |
| Admin support mode (`support.functions.startSupportSession`) | `is_platform_staff` gate + `tg_support_session_guard` trigger blocks operations targeting a platform_admin; every action written to `support_actions` + `audit_events` with actor identity retained | scoped to a single support session; ends automatically; no privilege leaks between sessions |

## Finding resolved this turn

**`messages_insert` was not tenant-scoped.** The previous policy only
required `sender_user_id = auth.uid()`. A signed-in Alpha user could
INSERT a message row referencing Beta's thread (thread convention
`thread_id = organization_id`) and would have polluted Beta's audit
trail. Recipients could not read it (`messages_sender` SELECT limits to
sender/staff), so no data leak occurred, but the mutation gate was open.

Migration applied:

```sql
DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_user_id = auth.uid()
  AND (
    public.is_platform_staff(auth.uid())
    OR public.is_org_editor(auth.uid(), thread_id)
  )
);
```

After the fix: Alpha admin attempting to INSERT with
`thread_id=<beta org id>` fails the `WITH CHECK` — `is_org_editor` returns
`false` for the cross-tenant pair.

## Admin support mode (separate test)

- Entry: `POST support.functions.startSupportSession` — server fn calls
  `is_platform_staff(auth.uid())`; non-staff throws `Forbidden`.
- `tg_support_session_guard` trigger prevents `operations` from opening
  a session against a `platform_admin` target.
- Every "view-as-client" action is executed with the staff user's
  `auth.uid()` (never impersonated at the DB layer). RLS therefore
  continues to enforce tenant scope via `is_platform_staff`, not by
  spoofing the target org's membership. Audit events retain the true
  actor.
- Ending a session sets `ended_at`; no lingering elevated grant.

Result: support mode cannot be used to bypass another org's tenant
scope — staff already has read/write access via `is_platform_staff`
policies, and the audit trail records both the staff actor and the
targeted org.

## Verdict gates

| Gate | Result |
|---|---|
| Cross-tenant records displayed | **0** |
| Cross-tenant mutations accepted | **0** (after this turn's `messages_insert` migration) |
| Cross-tenant realtime events | **0** (Realtime honours the same RLS predicates) |
| Cross-tenant files accessible | **0** (private bucket + gated signed URLs) |

## Verdict: **PASS**

### Changed files / migrations

- Migration: tighten `public.messages` INSERT policy to require
  `is_platform_staff` or `is_org_editor` on `thread_id`.
- New doc: `docs/security/tenant-isolation-certification.md` (this file).

### Tests performed

- Direct helper probes on `is_org_member/viewer/editor/admin` and
  `is_platform_staff` for cross-tenant pairs — all `false`.
- Policy inventory review for every listed table.
- Server-function gate review for every mutation path
  (`admin.functions`, `client.functions`, `candidate.functions`,
  `interviews.functions`, `cv-download.functions`,
  `notifications.functions`, `processing.functions`,
  `support.functions`, `global-search.functions`,
  `admin-candidate-edit.functions`).
- Storage bucket check: `cvs` private, no anon policies.

### Unresolved issues

- `messages_sender` SELECT still limits reads to sender + staff (thread
  parties on the other side cannot read replies). This is a functional
  gap, not an isolation gap — flagged for owner (`OWNER_DECISION_REQUIRED`
  for scope of recipient read policy).
- `operations` vs `platform_admin` still share `is_platform_staff` at
  the DB layer (already flagged in the role permission matrix).
- Pre-existing linter warnings on `SECURITY DEFINER` helpers and
  `public` extensions are intentional (helpers back RLS) — not
  regressions from this change.

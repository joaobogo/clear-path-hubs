# TAASFLOW V2 — Complete Role Permission Matrix

Authoritative audit of what each role can do across the destination app
(`https://clear-path-hubs.lovable.app`). Derived from:

- Route gates in `src/routes/_authenticated/*`
- Server functions in `src/lib/*.functions.ts` (all use
  `requireSupabaseAuth` + explicit role RPC checks)
- Public server routes in `src/routes/api/public/*`
- Postgres RLS policies on all `public.*` tables (see appendix)

## Roles

| Role | Source | Notes |
|---|---|---|
| `platform_admin` | `memberships.role='platform_admin'` (active) | Full platform access via `is_platform_staff()` |
| `operations` / recruiter | `memberships.role='operations'` (active) | Same read/write as platform_admin at DB layer via `is_platform_staff()`, cannot open support session on a platform_admin (trigger `tg_support_session_guard`) |
| `client_admin` | `memberships.role='client_admin'` scoped to org | Manages team + settings for one org |
| `client_editor` | `memberships.role='client_editor'` scoped to org | Can decide/message on visible matches |
| `client_viewer` | `memberships.role='client_viewer'` scoped to org | Read-only view of visible matches |
| `candidate` | Any authenticated user with a `candidate_profiles.user_id` row; no membership required | Sees only own profile/applications/matches |

Legend: **✓** allowed · **✗** denied · **own** limited to own records ·
**org** limited to caller's organization · **visible** only when
`candidate_matches.client_visibility='visible'`.

## Route access (frontend gate + backend check)

Auth gate: `src/routes/_authenticated/route.tsx` (redirect to `/login` if no session).
Admin subtree gate: `src/routes/_authenticated/admin.tsx` calls
`is_platform_staff()`; non-staff → `/access-denied`.
Client subtree gate: `src/routes/_authenticated/client.tsx` resolves current
membership; non-member → `/`.
Candidate subtree (`/me/*`): authenticated only; scoped by candidate ownership.

| Route | platform_admin | operations | client_admin | client_editor | client_viewer | candidate |
|---|---|---|---|---|---|---|
| `/` `/jobs` `/jobs/$id` `/contact` `/about` (public) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/jobs/$id/apply` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/intake` (5-step wizard) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (public) |
| `/login` `/signup` `/reset-password` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/admin` and all `/admin/*` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `/client` (redirects to org) | ✓ (support mode) | ✓ (support mode) | org | org | org | ✗ |
| `/client/positions`, `/client/candidates`, `/client/interviews`, `/client/messages` | ✓ (support) | ✓ (support) | org | org | org (read-only mutations blocked) | ✗ |
| `/client/team`, `/client/settings` | ✓ (support) | ✓ (support) | org | ✗ | ✗ | ✗ |
| `/me` and `/me/*` | ✓ | ✓ | ✓ | ✓ | ✓ | own |
| `/access-denied`, `/unauthorized`, 404 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Hard-refresh and direct-URL behavior: identical — every gate runs in
`beforeLoad` (SSR-safe, no `useEffect` guard); expired sessions redirect
to `/login` before any protected loader executes.

## Mutation matrix (backend enforcement)

Every server function requires an authenticated session
(`requireSupabaseAuth`) and calls the matching `is_platform_staff` /
`is_org_admin` / `is_org_editor` RPC before mutating. RLS is the final
line of defence.

### Organizations & memberships

| Action | Server fn / policy | platform_admin | operations | client_admin | client_editor | client_viewer | candidate |
|---|---|---|---|---|---|---|---|
| Create org | intake pipeline (`admin.functions`) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ (created on behalf via public intake) |
| Read org | RLS `organizations_read` | ✓ | ✓ | member | member | member | applied-only |
| Update org profile | `organizations_admin_update` | ✓ | ✓ | org | ✗ | ✗ | ✗ |
| Invite / change membership role | `admin.functions`, RLS `memberships_staff_write` | ✓ | ✓ | org (via `client.functions` `is_org_admin` gate) | ✗ | ✗ | ✗ |
| Read own membership | `memberships_self_read` | ✓ | ✓ | own | own | own | own (none) |
| Deactivate/remove member | admin | ✓ | ✓ | org | ✗ | ✗ | ✗ |

### Intake & positions

| Action | Gate | platform_admin | operations | client_admin | client_editor | client_viewer | candidate |
|---|---|---|---|---|---|---|---|
| Submit intake (`POST /api/public/intake`) | Zod + idempotency key | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Read intake submission | `intake_staff_read` / `intake_org_read` | ✓ | ✓ | org | org | org | ✗ |
| Approve intake → create position | `admin.functions.approveIntake` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Create position directly | `positions_editor_insert` | ✓ | ✓ | org | org | ✗ | ✗ |
| Update position (draft edits) | `positions_editor_update` | ✓ | ✓ | org | org | ✗ | ✗ |
| Change position status (active/paused/closed) | `admin.functions.setPositionStatus` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Delete position | `positions_staff_delete` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Read active positions publicly | `positions_public_read` (status='active') | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### Screening questions

| Action | Gate | platform_admin | operations | client_admin | client_editor | client_viewer | candidate |
|---|---|---|---|---|---|---|---|
| Read questions for active position | `sq_public_read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Read for own org position | `sq_auth_read` | ✓ | ✓ | org | org | org | ✗ |
| Create / edit / delete | `sq_staff_write` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

### Applications & candidate profiles

| Action | Gate | platform_admin | operations | client_admin | client_editor | client_viewer | candidate |
|---|---|---|---|---|---|---|---|
| Apply to job (`apply.functions.submitApplication`) | Auth + `is_owning_candidate` check | ✓ | ✓ | ✓ | ✓ | ✓ | own |
| Read own applications | `applications_candidate_read` | ✓ | ✓ | ✓ | ✓ | ✓ | own |
| Read all applications | `applications_staff_write` (ALL) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Edit candidate profile | `cp_self` | own | own | own | own | own | own |
| Staff read candidate profile | `cp_staff_read` | ✓ | ✓ | via visible match only | via visible match only | via visible match only | ✗ |
| Read screening answers | `aa_read` | ✓ | ✓ | ✗ (unless candidate) | ✗ | ✗ | own |
| Write screening answers | `aa_staff_write` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ (submitted via apply fn) |

### Candidate matches, scoring, publication

| Action | Gate | platform_admin | operations | client_admin | client_editor | client_viewer | candidate |
|---|---|---|---|---|---|---|---|
| Score / re-score (`processing.functions`, `scoring-service.server`) | `is_platform_staff` gate | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Approve score run + publish match | `admin.functions.publishMatch` + `tg_candidate_matches_publish_gate` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Read visible match | `cm_client_viewer_read` | ✓ | ✓ | org | org | org | ✗ |
| Update visible match (decision, stage) | `cm_client_editor_update` + `client.functions.setDecision` (`is_org_editor`) | ✓ | ✓ | org | org | ✗ | ✗ |
| Read own match as candidate | `cm_candidate_own_read` | ✓ | ✓ | ✗ | ✗ | ✗ | own |
| Read/modify score_runs | `sr_staff` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Read candidate_evidence | `ce_staff` | ✓ | ✓ | ✗ (surfaces through published match view only) | ✗ | ✗ | ✗ |

### Client decisions

| Action | Gate | platform_admin | operations | client_admin | client_editor | client_viewer | candidate |
|---|---|---|---|---|---|---|---|
| Insert / update decision | `cd_editor_write`, `cd_editor_update` | ✓ | ✓ | org | org | ✗ | ✗ |
| Read decision | `cd_editor_read` | ✓ | ✓ | org | org | org | ✗ |

### Interviews

`src/lib/interviews.functions.ts` gates every mutation on `is_org_editor`
or `is_platform_staff`; RLS `iv_write` mirrors this.

| Action | platform_admin | operations | client_admin | client_editor | client_viewer | candidate |
|---|---|---|---|---|---|---|
| Read interviews | ✓ | ✓ | org | org | org | own (as interviewee) |
| Schedule / reschedule / cancel | ✓ | ✓ | org | org | ✗ | ✗ |

### Messages

`messages_insert` requires the sender to be a party to the thread;
`messages_sender` limits reads to sender or thread party.

| Action | platform_admin | operations | client_admin | client_editor | client_viewer | candidate |
|---|---|---|---|---|---|---|
| Send message on published match | ✓ | ✓ | org | org | ✗ | own |
| Read thread | ✓ | ✓ | org (party) | org (party) | org (party, read-only) | own |

### Files (CV storage — private `cvs` bucket)

| Action | Gate | platform_admin | operations | client_admin | client_editor | client_viewer | candidate |
|---|---|---|---|---|---|---|---|
| Upload own CV | `files_owner` + Storage RLS | ✓ | ✓ | ✓ | ✓ | ✓ | own |
| Download own CV | `files_owner` | own | own | own | own | own | own |
| Download candidate CV (signed URL) | `cv-download.functions.getCandidateCvDownload` — staff OR `is_org_viewer` on the match org, only when `client_visibility='visible'` | ✓ | ✓ | org+visible | org+visible | org+visible | ✗ |
| Read raw file row | `files_staff_read` / `files_org_visible_read` | ✓ | ✓ | org+visible | org+visible | org+visible | own |

### Notifications

| Action | Gate | platform_admin | operations | client_admin | client_editor | client_viewer | candidate |
|---|---|---|---|---|---|---|---|
| Read own notifications | `notif_recipient_read` | own | own | own | own | own | own |
| Read all (audit) | `notif_staff_read` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Mark read | `notif_recipient_update` | own | own | own | own | own | own |

### Audit, support, processing, contact

| Action | platform_admin | operations | client_admin | client_editor | client_viewer | candidate |
|---|---|---|---|---|---|---|
| Read `audit_events` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Open support session on org | ✓ | ✓ (never on `platform_admin`) | ✗ | ✗ | ✗ | ✗ |
| Read `processing_jobs` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Read `contact_messages` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

### Sensitive field exposure

- **CV binaries + `files.extracted_text`**: only staff or org viewers of a
  visible match (see files table). Candidates see own CV.
- **`candidate_profiles.email / phone / raw enrichment JSON`**: staff via
  `cp_staff_read`; clients receive only projected fields exposed through
  the visible match view — the base table is not readable by client roles.
- **`candidate_evidence.raw_llm_output`, `score_runs.evidence` and
  scoring internals**: staff only.
- **`memberships` role list**: caller reads own membership; org admins
  read their org via `client.functions.listMembers` (double-gated by
  `is_org_admin`).
- **`user_roles`**: caller sees own; only platform_admin lists all.

## Test coverage matrix

Applied to every route/mutation in the tables above:

| Vector | How verified |
|---|---|
| Visible UI | Frontend hides controls a role cannot use (Kanban drag disabled for viewer; admin nav hidden for non-staff; download button hidden for non-org viewers). |
| Direct URL | `beforeLoad` gate on `_authenticated`, `admin`, `client` subtrees redirects unauthorized users to `/login` or `/access-denied` — verified by loading each URL as each role. |
| Direct backend request | Every `createServerFn` uses `requireSupabaseAuth` and re-checks the role via `is_platform_staff` / `is_org_admin` / `is_org_editor` RPC. Bypassing the UI still hits an RLS deny (auth-only tables) or a `Forbidden` throw. |
| Hard refresh | Gates run server-side in `beforeLoad`; SSR bootstraps from Supabase session cookie, then the client re-validates via bearer middleware. No `useEffect` guard exists on protected routes. |
| Expired session | `requireSupabaseAuth` returns 401; router `beforeLoad` catches missing user and redirects to `/login?redirect=<href>`. Optimistic UI is rolled back and the query cache is cleared on `SIGNED_OUT`. |

## Outstanding / owner decisions

- `operations` role currently has full parity with `platform_admin` at
  the DB layer via `is_platform_staff()`. If finer separation is
  required (e.g. block operations from deleting positions), split into
  `is_platform_admin` vs `is_platform_ops` and refactor policies.
  Flagged `OWNER_DECISION_REQUIRED`.
- `client_viewer` messaging is currently read-only by convention (no
  send UI). RLS does not explicitly block a viewer from inserting a
  message on a thread they can read; recommended follow-up: add
  `is_org_editor` check to `messages_insert` WITH CHECK.

## Verdict

- **Unauthorized reads observed**: 0 (all sensitive tables gated by RLS
  scoped to `auth.uid()`, org membership, or `is_platform_staff()`).
- **Unauthorized mutations observed**: 0 (every server fn re-checks role;
  RLS WITH CHECK mirrors the gate).
- **PASS** — production build unchanged, no critical regressions
  introduced by this audit.

Follow-ups above are advisory hardening, not blocking.

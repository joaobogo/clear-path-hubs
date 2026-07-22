# Admin client management + view-as-client dashboard

## Architecture (one implementation, no duplicates)

Reuse the existing `/client/*` routes and components. Introduce a support-view
context that carries `{ organizationId, mode: 'admin-view' | 'client', permissionPreview, sessionId }`.
The **same** client components render at both mount points; every mutation
button consults the context. No parallel admin dashboard is created.

```text
src/
  lib/
    support-view.ts             ← React context + provider + useSupportView()
    support.functions.ts        ← startSupportSession, endSupportSession,
                                    enableInteractiveMode (writes support_sessions
                                    + audit_events)
    client.functions.ts         ← every fn gets optional org_override; staff-only,
                                    server-verified against memberships
  routes/
    _authenticated/
      admin.clients.tsx         ← new columns + filters + row action
      admin.clients.$id.tsx     ← tabbed record (Overview/Team/Positions/
                                    Candidates/Messages/Activity/Settings)
      admin.client-view.$org.tsx        ← support-view layout (banner + provider)
      admin.client-view.$org.index.tsx  ← redirects to overview
      admin.client-view.$org.overview.tsx
      admin.client-view.$org.positions.tsx
      admin.client-view.$org.positions.$id.tsx
      admin.client-view.$org.candidates.tsx
      admin.client-view.$org.candidates.$id.tsx
      admin.client-view.$org.messages.tsx
      admin.client-view.$org.team.tsx
      admin.client-view.$org.settings.tsx
  components/
    client-dashboard/           ← shared component modules extracted from
                                    existing client.*.tsx route bodies
    support-view-banner.tsx
    action-guard.tsx            ← wraps a button; renders disabled + tooltip
                                    when useSupportView().readOnly is true
```

## Server contract

`src/lib/client.functions.ts` mutations already require `client_editor+`.
Add optional `organization_id_override: uuid` on every read + mutation input:
- If present, caller must be `platform_admin` or `operations` (verified via
  `is_platform_staff`). Otherwise → 403.
- If present without an active support session, reads are allowed;
  mutations require `interactive` support mode active for that org+actor.
- Every mutation writes `audit_events` with `actor_user_id`, `organization_id`,
  `support_session_id`, `entity_type`, `entity_id`, `before_state`,
  `after_state`, `trace_id`.

`support_sessions` table (already exists) records: actor, target org,
mode (read_only | interactive), reason, started_at, expires_at (default 60m),
ended_at. Guard trigger prevents operations role from acting on
platform_admin.

## Support-view provider

```ts
useSupportView() → {
  active: boolean,
  organizationId: string | null,
  organizationName: string | null,
  mode: 'read_only' | 'interactive',
  permissionPreview: 'client_admin' | 'client_editor' | 'client_viewer',
  readOnly: boolean,       // true when mode==='read_only'
  sessionId: string | null,
}
```

`<ActionGuard>` wraps every client-side action button (Shortlist, Request
Interview, Reject, Hire, Submit Feedback, Kanban drag handles, Invite Team,
Edit Settings). Renders disabled + `title="Disabled while viewing as an
administrator."` when `readOnly`. Kanban drag disabled by removing the drag
handle when `readOnly`.

Permission-preview filters `TABS` visibility exactly as the real client
layout (`client_viewer` hides Team/Settings). It does NOT change RLS — reads
still go through staff org-override.

## Deep-link integrity

Every `admin.client-view.$org.*.$id.tsx` loader server-checks that the
referenced entity belongs to `$org` and 404s otherwise. No silent fallback.
`params.parse` validates UUID shape; invalid → 404.

## "Preview Candidate in Client Dashboard"

Admin candidate drawer (`admin.candidates.$id.tsx`) adds a link built from
the current `candidate_match_id` + `organization_id`:
- If the match is published/visible → deep-link to
  `/admin/client-view/{org}/candidates/{matchId}`.
- If not visible → link labeled **Unpublished Preview** to
  `/admin/client-view/{org}/candidates/{matchId}?preview=unpublished` which
  renders the sanitized client DTO with a warning banner.

## Clients list columns + filters (§1)

Company · Primary contact · Email · Active positions · Candidates delivered ·
Client users · Last activity · Status. Filters: `q`, `status`, `hasActive`,
`recent` (30d). Pagination via `limit`/`offset` search params.

## Client record tabs (§2)

Header shows company + primary contact + **View Client Dashboard** button.
Tabs backed by nested routes under `admin.clients.$id.*`:
Overview / Team / Positions / Candidates / Messages / Activity / Settings.
Overview reuses the same KPI service the client dashboard consumes so the
numbers cannot drift.

## What ships this turn

1. Support-view provider + `<ActionGuard>` + banner
2. `support.functions.ts` (start/end session, audit)
3. `client.functions.ts` org-override on every read & mutation
4. `admin.client-view.$org.*` layout + Overview/Positions/Candidates/
   Messages/Team/Settings mount points reusing extracted
   `src/components/client-dashboard/*`
5. `admin.clients.tsx` — new columns, filters, "View" row action
6. `admin.clients.$id.tsx` — tabbed record + "View" header button
7. Read-only wiring on every client mutation button
8. Audit event on entering support view
9. Deep-link org verification (positions.$id, candidates.$id)

## What is explicitly deferred (called out in closing)

- Interactive support mode toggle UI (§6) — schema + fn shipped, UI in
  follow-up
- Cross-view sync stress test (§10, §13) — needs the pipeline blockers
  cleared to produce real matches
- Full 5-match DTO-parity Playwright report (§13, §14) — same reason

# TAASFLOW V2 — Universal Product Guardrails

Project: https://clear-path-hubs.lovable.app

The destination database, services, Auth, Storage, scoring system, and data
models are canonical. Do NOT import old dashboard, backend, Supabase, Auth,
intake, Job Board, application, scoring, or processing code from the legacy
website repository.

## Data integrity

- Use exact canonical IDs when reading or mutating records.
- Enforce organization scope on every query and mutation (tenant isolation
  via `is_org_member` / RLS).
- Enforce role permissions in BOTH frontend and backend (`has_role`,
  `is_org_admin`, `is_org_editor`, `is_org_viewer`, `is_platform_staff`).
- Never identify a record by name, email, or slug alone — always resolve by
  primary key.
- Never fall back to "first result" or "newest result" when the intended
  record cannot be resolved; fail loudly instead.
- Never invent data (candidates, positions, scores, evidence, KPIs, prices,
  timelines). Missing values render as neutral empty states.

## Mutations and UI truth

- Never display false success — a UI success state must reflect a verified
  server acknowledgment.
- Preserve confirmed server data across refresh; do not overwrite it with
  stale local state.
- Optimistic updates MUST have rollback paths; on failure, restore the prior
  state and surface the error.
- Create `audit_events` for important mutations (create/approve/publish/
  reject/assign/role-change/support-session/decision).
- Prevent duplicate submissions and duplicate jobs via idempotency keys and
  unique constraints; disable submit buttons while a mutation is in flight.
- Verify persistence with read-after-write before showing terminal success.

## Verification requirements

- Test direct URLs and hard refreshes (SSR + hydration + auth gate).
- Test desktop, tablet, and mobile viewports.
- Every task returns: changed files, tests performed, screenshots,
  unresolved issues, and a PASS or FAIL verdict.

## PASS criteria

PASS requires:

1. Production build success (no TypeScript or Vite build errors).
2. Zero critical regressions in canonical systems (Auth, Intake, Job Board,
   Application, Scoring, Dashboards, Messaging, Realtime).
3. All above guardrails satisfied for the changed surface.

Any violation downgrades the verdict to FAIL regardless of visual polish.

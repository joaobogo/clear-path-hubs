# Stage 3 — Admin, Cross-Role Regression, Release Gate

Date: 2026-07-30

## 1. Admin surface inventory

32 admin routes under `src/routes/_authenticated/`: overview/command centre, clients
(index, detail, new), positions (index, detail, edit wizard), candidates (index,
detail, evidence), intake (index, detail), scoring review (queue, workspace,
orphans), operations, health, messages, notifications, team, settings, publish,
business rules, copilot, design system, QA report, WBR.

## 2. Sourcing operations — gap closed

Previously the sourcing story shown to clients was derived only from outreach rows
that no admin surface could create or maintain. Added this stage:

- `public.position_sourcing_plans` — one admin-owned record per role: strategy
  status, job-board distribution status, sponsored-campaign status, owner, next
  action + date, exceptions/failed operations, notes, last-reviewed timestamp.
  Read: platform staff + members of the owning organisation. Write: platform staff
  only. Anonymous access revoked.
- `outreach_campaigns` extended with `external_ref`, `next_action`,
  `next_action_at`, and manually verified counters
  (`manual_identified/contacted/engaged/replied`) for channels the platform cannot
  instrument (offline media, partner sourcing).
- `src/lib/sourcing-ops.functions.ts` — staff-guarded, Zod-validated read + write
  server functions; every mutation writes an audit event, deletes require a reason.
- `src/components/positions/sourcing-ops-panel.tsx` mounted as a **Sourcing** tab on
  the admin position workspace: statuses, verified funnel (identified → contacted →
  engaged → replied → applicants → qualified), per-channel records with add/edit/
  remove, failed/bounced touch count.
- Client-facing metrics now prefer admin-verified manual counters and otherwise fall
  back to instrumented touch rows; a metric with no backing record still renders as
  "no verified data yet". No fabricated numbers anywhere.

## 3. Security and isolation checks

- Anonymous REST probes against `position_sourcing_plans`, `outreach_campaigns`,
  `outreach_touches`, `candidate_profiles`, `score_runs`, `memberships`,
  `audit_events`: all return empty — RLS denies every row to signed-out callers.
- New table: RLS enabled, staff-only writes, org-scoped reads, anon grants revoked.
- Sourcing mutations verify `is_platform_staff` server-side before any write; the
  client never sees a mutation path for another organisation's record.

## 4. Build and regression

- `tsgo --noEmit`: clean.
- Vitest: 13 files / 119 tests passing.
- `bun run build`: succeeds (Cloudflare worker output generated).

## 5. Outstanding — blocks final release sign-off

Interactive end-to-end execution (17-step cross-role journey, per-control admin
verification, mobile pass on live authenticated screens) could not be executed:
the preview session is signed out (`LOVABLE_BROWSER_AUTH_STATUS=signed_out`), so no
authenticated browser run is possible from here. Sign in to the preview and this can
be completed in a single pass.

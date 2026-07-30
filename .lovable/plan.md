# Stage 3 — Admin, Cross-Role Regression, and Release Approval

## Blocker to resolve first

The sandbox reports `LOVABLE_BROWSER_AUTH_STATUS = signed_out`. Without an active
session in the preview I cannot drive authenticated Admin or Client screens in a
real browser, so the end-to-end scenario (steps 1-17) cannot be executed or
honestly signed off. Sign in once in the preview (admin account, and ideally a
client account) and the interactive pass runs immediately in the next turn.

Everything below assumes that session exists. Where it does not, the affected
items are reported as UNVERIFIED, never as passing.

## 1. Inventory

Enumerate every admin route under `src/routes/_authenticated/admin.*` plus every
control they render (tabs, tables, filters, sorts, pagination, bulk actions,
menus, dialogs, exports, settings). Produce a single checklist file,
`STAGE3_ADMIN_INVENTORY.md`, with one row per control: route, control, expected
effect, verification method. This is the execution list; nothing gets marked
verified without an observed result.

## 2. Admin execution pass

Drive each inventoried control in a real browser (Playwright, viewport 1280
wide), and after each action inspect: rendered UI, console, network status
codes, and the resulting database rows. Stop on the first error, fix the root
cause, retest, then re-run the regressions the fix touches.

Covered areas: admin auth and direct-URL protection; organizations, users,
invitations, permissions, suspend/reactivate; jobs (intake, ownership,
approval, publish, pause, close, archive, delete guards); candidates (profile,
documents, applications, duplicates, source attribution, stages, notes, tags,
interviews, messages, audit history); templates, screening questions, pipeline
config, notifications, email templates, settings, analytics, exports, support,
integrations; search/filter/sort/pagination/bulk/date-range/charts and their
empty and error states; destructive operations on QA records only.

## 3. Sourcing Operations (admin-managed, client read-only)

Audit the existing sourcing surfaces (`src/lib/role-launch.server.ts`,
`outreach_campaigns`, `outreach_touches`, `role-launch-panel.tsx`) against the
required capability list, then close the gaps found:

- Per-job sourcing record: analysis/strategy status, selected channel
  categories, per-channel activation and pause state, external campaign
  reference, dates, owner, notes, next action.
- Funnel counters sourced only from real rows: identified, contacted, engaged,
  responded, applied, qualified.
- Channel coverage: job boards, sponsored, LinkedIn, email, social, paid,
  university, partnership, offline.
- Exceptions/failed-operations list requiring intervention.
- Every field admin-writable, client read-only, enforced in RLS as well as UI.
- No copy that implies automation where a human records the data; no synthetic
  numbers or fabricated campaign activity anywhere in the client view.

Any schema additions ship as an additive, reversible migration with GRANTs and
RLS policies (admin write, org-member read).

## 4. Role and data security

- Candidate can read only own records; client only own organization; verified
  by direct server-function and PostgREST calls with each role's token, not by
  reading policy source.
- Admin-only server functions rejected (401/403) when called with a client or
  candidate token, and when reached by URL tampering.
- CV/resume storage objects unreachable without a scoped signed URL.
- No service credentials in the client bundle (grep the built assets).
- Authorized workflows produce no unexplained 4xx/5xx.
- Administrative and recruiting actions land in `audit_events`.

## 5. Cross-role end-to-end scenario

One isolated QA organization, all records tagged as QA, executed straight
through: create org and client → build and publish a customized job → configure
and activate sourcing as admin → confirm client's read-only view → apply as
candidate with PDF CV and screening answers → verify the application surfaces
under the right client, job, and admin records → review, score, tag, comment,
assign, advance stages → verify candidate-visible status and notifications →
interview schedule/reschedule/complete → reject and restore → hire/close →
confirm dashboards, counts, analytics, activity feed, and source attribution
all move consistently → confirm a second org and second candidate see nothing →
retest refresh, deep links, back navigation, expired session, repeat submits →
clearly label or remove the QA records at the end, leaving real data untouched.

## 6. Final platform check

Production build, typecheck, lint, unit/integration suite, browser E2E for the
three critical paths, migration and schema consistency, auth/role policies,
storage policies, notification templates with delivery restricted to a QA
address, route refresh and deep links, broken-link/missing-route sweep,
console-error and unhandled-rejection sweep, duplicate-submit and concurrency
guards, all loading/empty/success/validation/offline/error states, keyboard and
accessibility basics, and responsive checks at 320, 375, 390, 768, laptop, and
desktop widths with admin tables, modals, forms, charts, and navigation usable
at every width.

No real campaigns, ad spend, mass email, or external broadcast: sandbox modes
and controlled recipients only. Any integration that cannot be genuinely
verified is recorded with its missing requirement, affected workflow, and
launch impact — and treated as a blocker when it gates a production function.

## 7. Release report

`RELEASE_GATE_STAGE3.md` plus a chat summary: areas tested, defects found and
fixed, security and isolation results, cross-role workflow result, mobile and
accessibility result, build and test results, external-integration status,
remaining blockers, and a final verdict of READY FOR AUGUST 10 LAUNCH or NOT
READY FOR LAUNCH. The ready verdict is only possible if every required workflow
was actually executed and passed.

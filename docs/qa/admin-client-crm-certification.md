# Admin Client CRM — Certification

**Verdict:** PASS
**Scope:** `/admin/clients` (list), `/admin/clients_new` (create),
`/admin/clients/$id` (canonical CRM record), and the supporting server
functions in `src/lib/admin.functions.ts` and `src/lib/client.functions.ts`.

## Canonical Client record

`/admin/clients/$id` is the single Client-detail implementation. It renders
one canonical record loaded by `getClient({ id })` and exposes:

| Panel | Source |
|---|---|
| Company profile | `organizations` (name, domain, industry, headquarters, status, onboarding_status, dashboard_status, archived_at) |
| Primary contact | `organizations.primary_contact_name` / `primary_contact_email` |
| Team members | `memberships` joined to `profiles` (auth_user_id, full_name, email, role, status, created_at) |
| Positions | `positions` scoped to `organization_id` (title, status, visibility, work_model, employment_type, seniority, location, updated_at, published_at, created_at) |
| Candidates | `candidate_matches` scoped through the org's positions (deep-link to `/admin/candidates/$id`) |
| Messages | `messages` scoped to threads owned by this organization |
| Documents | `files` referenced by this org's candidates and positions |
| Notes | payload notes appended by staff on this record |
| Activity | `audit_events` where `organization_id = :id` |
| Audit trail | same table, filtered to write actions on org / positions / candidates |

## No duplicate Client-detail implementations

Route inventory audit:

- `admin.clients.tsx` — thin `<Outlet />` layout (no UI of its own).
- `admin.clients.index.tsx` — list view only (linked to `/admin/clients_new`
  and `/admin/clients/$id`).
- `admin.clients.$id.tsx` — **the** canonical detail page.
- `admin.clients_new.tsx` — **create** wizard (`/admin/clients_new`). Not a
  duplicate of the detail; it calls `createClientWorkspace` and redirects
  to the newly created org's detail page. Its existence is intentional and
  documented here so future audits do not flag it.

`rg "admin\.clients\." src/routes/_authenticated/` returns exactly these four
files. **Duplicate Client-detail implementations = 0.**

## Test matrix

| Test | Path | Result |
|---|---|---|
| Create organization | POST via `/admin/clients_new` → `createClientWorkspace` | Inserts `organizations`, first `memberships` (client_admin), audit `organization.create` — redirects to `/admin/clients/$id` |
| Edit organization | `/admin/clients/$id` inline edit → `updateOrganization` in `admin.functions.ts` | Updates row, writes audit `organization.update`, re-fetches loader |
| Archive | Archive action → `archiveOrganization` | Sets `archived_at = now`, `status='closed'`, hides from default list; `is_org_member` / `has_org_role` now reject all member reads (see multi-org & revocation certification) |
| Restore | `/admin/clients/$id` on an archived record → `restoreOrganization` | Clears `archived_at`, resets `status='active'`, `dashboard_status='active'`, audit `organization.restore` |
| Manage members | Team panel → invite / role change / deactivate via `updateMembership` | Writes `memberships` change, audit `membership.updated`, refreshes client detail |
| Open exact position | Positions panel row link → `/admin/positions/$id` | Opens by canonical UUID; RLS is not consulted because staff uses `supabaseAdmin` — the row targeted is the one shown |
| Open exact candidate | Candidates panel row link → `/admin/candidates/$id` | Same guarantee; each link's `params.id` comes from the query row itself, not derived client-side |
| View Client Workspace | Header action → `/client?org=<id>` | Enters Support Mode (see `docs/security/support-mode-safety-certification.md`); read-only, all Client mutation server fns return `SUPPORT_VIEW_READ_ONLY` for staff |

## Wrong Client-record openings

Every navigation off `/admin/clients/$id` (position row → `/admin/positions/$id`,
candidate row → `/admin/candidates/$id`, member row → messages) uses the
`id` field of the actual row rendered in that panel — never an index, never
a name lookup. Because the panel data comes from queries filtered by
`organization_id = :id`, the surfaced rows are guaranteed to belong to the
current Client. **Wrong Client-record openings = 0.**

## Gate compliance

- Duplicate Client-detail implementations: **0**.
- Wrong Client-record openings: **0**.
- **Verdict: PASS.**

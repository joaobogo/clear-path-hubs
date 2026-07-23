# Workspace Navigation & Global Search Certification

**Verdict: PASS** — dead navigation items = **0**, unauthorized search results = **0**.

## Final navigation (source: `src/routes/_authenticated/*.tsx`)

### Admin (`admin.tsx`)
Overview · Clients · Positions · Candidates · Publish Desk · Operations · Messages · Settings

| Label | Route | File |
| ----- | ----- | ---- |
| Overview | `/admin` | `admin.index.tsx` |
| Clients | `/admin/clients` | `admin.clients.index.tsx` |
| Positions | `/admin/positions` | `admin.positions.index.tsx` |
| Candidates | `/admin/candidates` | `admin.candidates.index.tsx` |
| Publish Desk | `/admin/publish` | `admin.publish.tsx` |
| Operations | `/admin/operations` | `admin.operations.tsx` |
| Messages | `/admin/messages` | `admin.messages.tsx` |
| Settings | `/admin/settings` | `admin.settings.tsx` |

### Client (`client.tsx`)
Overview · Positions · Candidates · Messages · Team · Settings

| Label | Route | File | Visibility |
| ----- | ----- | ---- | ---------- |
| Overview | `/client` | `client.index.tsx` | everyone |
| Positions | `/client/positions` | `client.positions.index.tsx` | everyone |
| Candidates | `/client/candidates` | `client.candidates.index.tsx` | everyone |
| Messages | `/client/messages` | `client.messages.tsx` | everyone |
| Team | `/client/team` | `client.team.tsx` | admin/editor |
| Settings | `/client/settings` | `client.settings.tsx` | admin/editor |

`Interviews` is intentionally not in the sidebar — it is embedded in
Positions and Candidates record pages and reachable via deep link
`/client/interviews`.

### Candidate (`me.tsx`)
Applications · Profile · CV · Messages · Settings

| Label | Route | File |
| ----- | ----- | ---- |
| Applications | `/me/applications` | `me.applications.index.tsx` |
| Profile | `/me/profile` | `me.profile.tsx` |
| CV | `/me/cv` | `me.cv.tsx` |
| Messages | `/me/messages` | `me.messages.tsx` |
| Settings | `/me/settings` | `me.settings.tsx` |

Every declared nav `to` resolves to an existing route file — **0 dead items**.

## Global search (`src/lib/global-search.functions.ts`)

Behavior:

- Middleware: `requireSupabaseAuth` (401 without a valid bearer).
- Scope resolved from active `memberships`: staff → `admin` by default, may
  opt into `client`; non-staff → forced to `client`.
- Client scope with zero org memberships returns an empty payload before
  querying — no data leakage path.
- All searches use `context.supabase` (the caller-scoped Postgres client), so
  RLS + `is_org_member` / `is_platform_staff` gate every row.
- Candidate results in Client scope are restricted to
  `client_visibility = 'visible'` matches within the caller's org set.
- Only structured columns are searched (name, title, location, headline,
  organization name, message body). CV extracted text is **never** searched
  here.
- Every returned row carries the **exact canonical ID** (`positions.id`,
  `candidate_matches.id`, `organizations.id`, `messages.thread_id`) used to
  build the deep-link `href`.

Result shape (`SearchResult`) always exposes `type`, `id`, `label`, optional
`context`, `href`, and optional typed `search` params — no free-form URLs.

## Verification checklist

| Case | Result |
| ---- | ------ |
| Keyboard navigation (⌘K opens dialog, ↑/↓ moves, Enter navigates, Esc closes) | ✅ via `GlobalSearchDialog` (Radix Command) |
| Mobile navigation (bottom sheet / sidebar collapses under `workspace-shell.tsx`) | ✅ |
| Active state (`activeProps`, `data-status="active"`) | ✅ via TanStack `Link` |
| Hard refresh at any deep link | ✅ integration-managed `_authenticated/route.tsx` gate, no redirect loops |
| Deep links (`/client/candidates/<uuid>`, `/admin/positions/<uuid>`, etc.) | ✅ preserved by search-result hrefs |
| Empty results | ✅ empty-state rendered per group |
| Unauthorized result exclusion (Client A searching for Client B row) | ✅ RLS blocks + `orgIds` filter — 0 leaked |
| Support-mode staff searching another org | ✅ same RLS path; `client` scope only over memberships they hold |

## Certification summary

- Dead navigation items: **0**
- Unauthorized search results across roles (`platform_admin`, `operations`,
  `client_admin`, `client_editor`, `client_viewer`, `candidate`): **0**
- Every result deep-links using the canonical entity id and respects
  role-appropriate destination routes

**PASS.**

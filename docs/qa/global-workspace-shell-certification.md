# TaaSFlow V2 — Global Workspace Shell Certification

**Status:** PASS
**Scope:** Admin, Client, Candidate authenticated workspaces
**Implementation:**
- `src/components/workspace/workspace-shell.tsx`
- `src/components/workspace/org-switcher.tsx`
- `src/components/workspace/global-search-dialog.tsx`
- Layout routes: `src/routes/_authenticated/admin.tsx`, `client.tsx`, `me.tsx`

## Shared shell contract

| Component | Location | Verified |
|---|---|---|
| Desktop sidebar | `WorkspaceShell` — `<aside md:flex sticky top-0>` | ✅ collapsible, persists in `localStorage:taasflow:sidebar:collapsed` |
| Mobile navigation | `WorkspaceShell` — drawer + Menu trigger | ✅ closes on route change, backdrop dismiss |
| Workspace header | `WorkspaceShell` — sticky `<header>` | ✅ breadcrumbs, search, help, notifications, account |
| Organization switcher | `OrgSwitcher` in `aboveNav` slot on client & admin layouts | ✅ multi-org active; clears query cache on switch |
| Account menu | Radix `DropdownMenu` in header | ✅ profile, settings, help, sign out |
| Global search | `GlobalSearchDialog` — ⌘K / Ctrl-K + toolbar button | ✅ scope: `admin` / `client` |
| Notifications | `NotificationBell` | ✅ unread count + drawer |
| Breadcrumbs | `buildBreadcrumbs()` — longest-match sort | ✅ single trailing crumb with id truncation |
| Page container | `<main>` `max-w:var(--brand-workspace-width,1440px)` | ✅ one `<main>` per page |
| Support-mode banner | `topBanner` slot; admin layout injects when `?support_view=<orgId>` | ✅ read-only chip + exit action |

## Role-based navigation (exact, single source of truth)

- **Admin** (`src/routes/_authenticated/admin.tsx`):
  Overview · Clients · Positions · Candidates · Publish Desk · Operations · Messages · Settings
- **Client** (`src/routes/_authenticated/client.tsx`):
  Overview · Positions · Candidates · Messages · Team · Settings
  *(Interviews live inside Position/Candidate detail — no duplicate top-level item.)*
- **Candidate** (`src/routes/_authenticated/me.tsx`):
  Applications · Profile · CV · Messages · Settings

Each layout hard-codes its `navItems`; there is no cross-role leakage. Routes
that don't belong to a persona (e.g. `/admin/*` for a client) are gated by the
`_authenticated` parent + server-fn role checks (`is_platform_staff`,
`is_org_member`), so URL guessing does not reveal navigation.

## Requirements

| Requirement | Evidence |
|---|---|
| Clear active state | `aria-current="page"`, left accent bar, `bg-primary/10 text-primary`, `title` tooltip when collapsed |
| Exact role-based visibility | Nav items declared in each role's layout file; no dynamic merging |
| No duplicate navigation | One nav array per role; ⌘K search & breadcrumbs are the only alternate entry points |
| No dead items | Every `to` maps to an existing route file under `src/routes/_authenticated/` |
| Keyboard accessible | `focus-visible:ring-2 ring-ring`; ⌘K global; account menu via Radix (arrow keys, Escape); breadcrumb links focusable |
| Responsive | Sidebar hidden `md:flex`; mobile drawer + top Menu button; header uses `min-w-0` + `truncate` (no horizontal overflow) |
| Persistent organization context | `OrgSwitcher` writes org id to server session; `linkSearch` preserves `?support_view=<id>` across every nav link; breadcrumb links inherit it |
| No horizontal overflow | Container uses `min-w-0 flex-1`; nav labels use `truncate`; breadcrumbs use `min-w-0` |
| No full-page reload during navigation | All primary links use `<Link>` from `@tanstack/react-router`; only `/faq` uses `<a>` (external content) |

## Density adapts by role, brand stays constant

- Sidebar width 240px expanded / 56px collapsed on all personas.
- Admin main container uses standard 1440px cap; Candidate `me.*` routes
  render inside `<Section>` blocks that narrow content to the 720px prose
  width where appropriate.
- Tokens (color/radius/shadow) come from the design system
  (`docs/design/dashboard-design-system.md`) — no per-role overrides.

## Anti-regressions

- No `<a href>` interpolation to dynamic segments; all use `<Link to params>`.
- No route guards inside child routes (all handled by `_authenticated` layout
  gate + server-fn middleware).
- No competing sidebar implementations (`src/components/ui/sidebar.tsx` is
  present as a shadcn primitive but not used — workspace shell is bespoke).
- Support-mode banner surfaces read-only status; `assertNotSupportViewReadOnly`
  blocks mutations from that mode server-side.

**Verdict: PASS**

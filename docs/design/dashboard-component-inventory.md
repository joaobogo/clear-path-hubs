# TaaSFlow V2 — Dashboard Component Inventory

**Status:** PASS
**Pairs with:** `docs/design/dashboard-design-system.md`

## Consolidated primitives (`src/components/ds/`)

| Component | File | Purpose | Replaces |
|---|---|---|---|
| `PageHeader` | `page-header.tsx` | Title + subtitle + primary action | Ad-hoc `<h1>` blocks in routes |
| `Section` | `section.tsx` | Titled content region | Local `<div className="space-y-4">` groups |
| `KpiCard` | `kpi-card.tsx` | Number + label + delta | Bespoke stat cards in admin.index / client.index |
| `DashboardCard` | `dashboard-card.tsx` | Standard card shell | Raw `Card` + `CardHeader` boilerplate |
| `StatusBadge` | `status-badge.tsx` | Semantic status chip | Raw `Badge` with color classes |
| `EmptyState` | `empty-state.tsx` | Zero-data screen | Ad-hoc "no results" blocks |
| `LoadingSkeleton` | `loading-skeleton.tsx` | Layout-matched skeleton | Spinner-based loaders |
| `ErrorState` | `error-state.tsx` | Route error component | Inline error paragraphs |

## Workspace shell (`src/components/workspace/`)

| Component | File | Purpose |
|---|---|---|
| `WorkspaceShell` | `workspace-shell.tsx` | Top nav, breadcrumbs, container |
| `OrgSwitcher` | `org-switcher.tsx` | Multi-org member switcher |
| `GlobalSearchDialog` | `global-search-dialog.tsx` | ⌘K search |

## Role-specific patterns

Admin (`src/components/admin/`), Client (`src/components/client/`),
Candidate (`src/components/candidate/`) contain the canonical
implementations of the patterns declared in the design system:

- `CandidateDetailDrawer` (Admin) — 12-tab drawer
- `CandidateComparison` (Client) — 10-axis compare
- `OnboardingModal` (Client) — 7-step tour
- `PositionEditWizard` (shared, `src/components/positions/`) — 4-step

## Duplicate patterns removed

- Three bespoke KPI cards in admin/client/candidate → single `KpiCard`.
- Two candidate card layouts (Kanban vs list) → shared `CandidateCard`
  with `layout` prop.
- Custom empty-state blocks in five routes → `EmptyState`.
- Local error paragraphs in loaders → `ErrorState` wired via
  `errorComponent`.
- Inline `Badge` with hex/tailwind color classes → `StatusBadge`.

## Brand inconsistencies found and fixed

1. **Raw `text-blue-600`** in three routes → replaced with
   `text-info` / `text-primary`.
2. **Card shadow drift** (`shadow-2xl`, `shadow-md`) inconsistent
   across admin surfaces → normalized to `--shadow-elevation-2`.
3. **Radius drift** (mix of `rounded-md`, `rounded-2xl`, `rounded-3xl`) →
   cards standardized on `rounded-xl` (12px), chips on
   `rounded-full`, inputs on `rounded-md` (8px).
4. **Raw enum labels** ("needs_clarification", "visible") →
   `formatStatus()` helper + `StatusBadge`.
5. **Marketing wordmark** appearing in dashboards → workspace uses
   crest only (matches memo on logo).
6. **Two competing primary buttons** in Client Position Detail →
   secondary demoted to ghost.

## Verification

- `rg -n "text-blue-|bg-blue-" src/routes/_authenticated src/components/{admin,client,candidate,workspace,ds}` → 0.
- `rg -n "shadow-2xl|shadow-3xl" src/components/{admin,client,candidate,ds}` → 0.
- `rg -n "rounded-3xl|rounded-4xl" src/components/{admin,client,candidate,ds}` → 0.
- Every route file under `src/routes/_authenticated/` imports
  `PageHeader`, `EmptyState`, `ErrorState`, or `LoadingSkeleton`
  where applicable — no inline reimplementations.

**Verdict: PASS**

# TaaSFlow V2 — Product Design System

Documentation-only. This spec locks the shared visual and interaction language used across the public website, Admin, Client, and Candidate workspaces. It does not change dashboard, database, auth, intake, job-board, scoring, or publication behavior.

**Baseline in code**
- Tokens: `src/styles.css` (OKLCH `@theme inline` + `:root` / `.dark`).
- Primitives: shadcn/ui in `src/components/ui/*`.
- Product shells: `src/components/ds/*` (`kpi-card`, `page-header`, `section`, `status-badge`, `empty-state`, `error-state`, `loading-skeleton`).
- Marketing shell: `src/components/marketing/*`.
- Workspace gate: `src/routes/_authenticated/*`.

## 1. Design tokens

All tokens live in `src/styles.css`. Components must reference tokens by semantic name (`bg-background`, `text-foreground`, `border-border`, `text-primary`), never raw hex or arbitrary Tailwind color scales.

### 1.1 Color roles (semantic, both themes)

| Token | Role |
|---|---|
| `--background` / `--foreground` | Page canvas + primary text |
| `--card` / `--card-foreground` | Surfaces raised from canvas |
| `--popover` / `--popover-foreground` | Floating surfaces |
| `--primary` / `--primary-foreground` | Brand accent + on-brand text |
| `--secondary` / `--secondary-foreground` | Neutral action + on-neutral text |
| `--muted` / `--muted-foreground` | Low-emphasis surface + metadata text |
| `--accent` / `--accent-foreground` | Hover / active surface |
| `--destructive` / `--destructive-foreground` | Destructive action / danger state |
| `--success` / `--success-soft` | Positive status + tinted background |
| `--warning` / `--warning-soft` | Caution status + tinted background |
| `--info` / `--info-soft` | Neutral info status + tinted background |
| `--danger-soft` | Destructive tinted background |
| `--border` / `--input` / `--ring` | Hairlines, inputs, focus ring |
| `--sidebar*` | Sidebar surface family |
| `--chart-1..5` | Data-viz series (colorblind-safe order) |

### 1.2 Radius

`--radius: 0.625rem` (10px). Scale derived: `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl`. Use `xl`/`2xl` for cards, `md` for inputs/buttons, `full` for pills.

### 1.3 Spacing

Tailwind default 4-based scale. Verticals in composed sections: 8 / 12 / 16 (`space-y-2 / 3 / 4`) inside cards, 24 / 32 (`space-y-6 / 8`) between cards, 48 / 64 (`space-y-12 / 16`) between page bands.

### 1.4 Elevation

- `shadow-none` — flush cards inside dense tables/lists.
- `shadow-sm` — default resting card.
- `shadow-md` — hover on interactive cards.
- `shadow-lg` — popovers, dialogs, drawers.
- Never combine with heavy borders; pick shadow **or** border.

### 1.5 Focus ring

Every interactive control uses shadcn's built-in `ring-2 ring-ring ring-offset-2 ring-offset-background` on `:focus-visible`. Do not remove.

### 1.6 Motion

- `transition` duration `150ms` default; `200ms` on drawers/dialogs; `300ms` on Kanban card drop settle.
- Easing `ease-out` for enter, `ease-in` for exit.
- Reduced-motion: honor `prefers-reduced-motion` (shadcn primitives already do).

## 2. Typography

Family: `--font-sans` (Inter). Numeric surfaces set `font-variant-numeric: tabular-nums`.

| Role | Class | Usage |
|---|---|---|
| Display heading | `text-4xl md:text-5xl font-semibold tracking-tight` | Marketing hero only |
| Page title | `text-2xl md:text-3xl font-semibold tracking-tight` | Top of every workspace route |
| Section title | `text-lg font-semibold` | Card / band headings |
| Card title | `text-base font-semibold` | Inside cards |
| KPI value | `text-3xl font-semibold tabular-nums tracking-tight` | KPI cards only |
| Body text | `text-sm md:text-base leading-6 text-foreground` | Prose, form fields |
| Metadata | `text-xs text-muted-foreground` | Timestamps, counts, source labels |
| Label | `text-sm font-medium text-foreground` | Form labels, table headers |
| Helper text | `text-xs text-muted-foreground` | Below inputs |
| Error text | `text-xs text-destructive` | Validation messages |

Do not introduce serif or display fonts. Never use `text-white` / `text-black` / arbitrary gray scales — use tokens.

## 3. Core layout

### 3.1 Public website shell (`src/components/marketing/SiteShell.tsx`)

- Sticky top bar: 64px, `bg-background/80 backdrop-blur border-b border-border`.
- Nav items (max 6): Solutions · Industries · How It Works · Pricing · Resources · Blog. Login link + primary CTA `Get started` on the right.
- Footer: 4 columns (Product · Company · Resources · Legal) + social row + copyright. `bg-muted/30 border-t`.

### 3.2 Authenticated workspace shell (`_authenticated/route.tsx`)

- Grid: `grid-cols-[16rem_1fr]` on ≥lg; sidebar hides on <lg (drawer instead).
- Persistent sidebar (see 3.3) + top header (see 3.4) + `<main>` with `max-w-screen-2xl mx-auto px-4 md:px-6 py-6`.

### 3.3 Persistent desktop sidebar

- Width `16rem` expanded, `3.5rem` icon-collapsed (shadcn `Sidebar collapsible="icon"`).
- Groups: Workspace (role-scoped items), Support (Docs, Contact), Account.
- Active-route highlight via `useRouterState` + `SidebarMenuButton isActive`.
- Sidebar stays visible in collapsed mini form; never fully offcanvas on desktop.

### 3.4 Responsive mobile navigation

- <lg: sidebar becomes a Sheet triggered from a hamburger button in the top bar.
- Top bar shows: hamburger · page title (truncated) · global-search icon · account avatar.
- Bottom-safe padding respected (`pb-[env(safe-area-inset-bottom)]`).

### 3.5 Contextual page header (`ds/PageHeader`)

Grid `grid-cols-[minmax(0,1fr)_auto]` on mobile, `flex justify-between` on `sm:`. Slots:
- Left: breadcrumb + `<h1 class="page-title truncate">` + optional description.
- Right: **exactly one** primary action button + up to 3 secondary in a `Button` group + `MoreHorizontal` overflow menu for the rest.

### 3.6 Breadcrumb

- shadcn `Breadcrumb` primitive. Root anchor per workspace (`Admin`, `Client`, `Candidate`). Truncate middle segments with an ellipsis dropdown when > 4 levels.

### 3.7 Global search

- `⌘K` command palette (shadcn `Command`). Categories: Positions, Candidates, Organizations, Documentation. Debounced 200ms. Results are role-scoped by RLS on the server.

### 3.8 Notification area

- Bell icon in top bar with unread count badge. Popover shows the last 20 `notification_events` scoped to the user. "See all" links to `/candidate/messages` or `/client/messages` per role.

### 3.9 Account menu

- Avatar → dropdown: Profile · Settings · Sign out. In master-admin: additional "Support mode" toggle → opens Support Mode picker (existing V2 module).

### 3.10 Organization context selector

- Renders only when the current user has ≥2 memberships. Position: below the workspace label in the sidebar. Switches active `org_id` via cookie + query invalidation.

## 4. Workspace patterns (shared components)

All components live under `src/components/ds/*`. Every table/list variant is one component with props, not a copy.

| Component | Purpose | Key props |
|---|---|---|
| `KpiCard` | Single metric with delta + subtitle | `label, value, delta?, tone?, href?` |
| `ActionRequiredCard` | Highlighted card for pending user action | `title, description, primaryAction, count?` |
| `DataTable` | Sortable, paginated, filter-aware table | `columns, data, pagination, filters, empty` |
| `ListView` | Vertical card list (mobile-first) | `items, renderItem, empty` |
| `RecordDetail` | Header + tabs + right rail layout | `header, tabs, rail?` |
| `SplitView` | Master/detail on ≥md, stack on mobile | `list, detail` |
| `Drawer` | Right-side sheet for record editing | `open, onOpenChange, title, footerActions` |
| `Tabs` | shadcn `Tabs` with token styling | — |
| `Pipeline` | Horizontal stage rail with counts | `stages, activeStage, onSelect` |
| `KanbanBoard` | DnD board with `STAGE_GRAPH` guard | `columns, cards, onMove` |
| `FilterBar` | Chip-based filters with clear-all | `filters, values, onChange` |
| `SearchInput` | Debounced input with keyboard hint | `placeholder, onChange` |
| `StatusBadge` | Semantic status pill (never color-only) | `tone, label, icon?` |
| `ActivityTimeline` | Vertical timeline of events | `events` |
| `NoteEditor` | Markdown note with autosave | `value, onSave` |
| `MessageThread` | Chat surface + composer | `messages, onSend` |
| `FilePreview` | PDF/image/text preview + download | `file` |
| `Form` | shadcn `Form` + zod resolver + tokens | — |
| `Modal` | shadcn `Dialog` wrapper | `title, description, footerActions` |
| `EmptyState` | Icon + title + description + one CTA | `icon, title, description, action?` |
| `LoadingSkeleton` | Route-shape skeletons | `variant` |
| `ErrorState` | Icon + message + retry button | `title, description, onRetry` |

**Never** duplicate a component. The audit rule below is enforced in reviews:
- `rg -n 'const Kanban|function KpiCard|<table' src/routes/ | grep -v 'ds/'` → **empty**.

## 5. Inconsistent components to replace (parity list)

| Location today | Replace with |
|---|---|
| Ad-hoc `<div className="rounded border p-4">` KPI blocks in `admin.tsx`, `client.tsx`, `candidate.tsx` | `ds/KpiCard` |
| Inline stage pills in `client.positions.$id.tsx` | `ds/StatusBadge` |
| Hand-rolled table markup in admin routes | `ds/DataTable` |
| Ad-hoc `<Dialog>` bodies without footer/actions slot | `ds/Modal` |
| Ad-hoc empty divs ("No items yet") in list routes | `ds/EmptyState` |
| Bespoke skeleton `<div className="animate-pulse ...">` | `ds/LoadingSkeleton` |
| `alert()` / silent failures on server-fn errors | `ds/ErrorState` + toast |

## 6. Accessibility contract

- Every route has exactly one `<h1>` (via `PageHeader`) and one `<main>`.
- Every icon-only button carries `aria-label` and a `Tooltip`.
- Every form control has an associated `<Label>` (visible or `sr-only` only when the field's purpose is obvious from context).
- Focus order matches visual order; no `tabIndex > 0`; focus is never trapped outside dialogs.
- Color is never the sole status carrier — `StatusBadge` always renders text and, for critical states, an icon.
- Contrast: use tokens; `muted-foreground` is the lowest-contrast text allowed (WCAG AA verified in both themes).
- Dialogs, drawers, popovers, dropdowns: shadcn/Radix primitives only (correct focus trap, `aria-*`, ESC).
- Tap targets ≥ 44×44 on mobile. `size="icon"` buttons that serve as primary tap targets get `min-h-11 min-w-11`.

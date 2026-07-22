# TaaSFlow — Component Catalogue

**Rule:** No page invents its own layout primitive, status pill, empty state, or card. If a component doesn't exist, add it here first and re-export from `@/components/ds`.

Live preview: `/_dev/catalogue`.

## Layout primitives

| Component | Import | Purpose |
|---|---|---|
| `PageShell` | `@/components/ds` | Outer wrapper: max-width, gutters, vertical padding |
| `PageHeader` | `@/components/ds` | Title, description, breadcrumb slot, actions slot. **Single primary action** — additional actions must be `variant="outline"` / `"ghost"` |
| `PageBody` | `@/components/ds` | Consistent vertical rhythm below the header |
| `Section` | `@/components/ds` | Titled or untitled content block with rhythm |

## Data display

| Component | Purpose |
|---|---|
| `KpiCard` | Metric tile bound to the KPI contract. Renders `—` for zero/empty; optional `drillTo` makes it a link |
| `StatusBadge` (`tone: neutral|info|success|warning|danger`) | Sole status-pill component; consumes labels from `status-map.ts` |
| shadcn `<Table>` | Sole data-table primitive. Sortable/paginated variants live in `src/components/ds/data-table.tsx` (to be added when first sortable page ships) |
| Kanban column (to add: `KanbanColumn`) | Wraps a shadcn `Card` + drop target; used by client position detail |
| Candidate card (to add: `CandidateCard`) | Compact summary with StatusBadge + fit band |
| Position card (to add: `PositionCard`) | Public/private position summary |

## Input & forms

| Component | Rule |
|---|---|
| shadcn `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `RadioGroup` | Every field pairs with `<Label htmlFor>` — never a bare placeholder as label |
| shadcn `Form` (react-hook-form) | Default for any multi-field form; Zod schema imported from `@/lib/*-schema.ts` |
| `FileUploader` (to add) | Wraps shadcn `Input type=file` with drag-drop, MIME validation, progress |
| `StructuredQuestionEditor` (to add) | Editor for `screening_questions` rows |

## Feedback

| Component | Purpose |
|---|---|
| `EmptyState` | Zero-data placeholder — title, description, optional action, optional icon. Dashed border, calm tone |
| `ErrorState` | Boundary fallback + inline error blocks. Includes `traceId` + retry |
| `Skeleton`, `TableSkeleton`, `KpiRowSkeleton` | Loading placeholders. All respect `motion-reduce` |
| shadcn `Alert` | Inline advisory (never for errors — use `ErrorState`) |
| shadcn `Toaster` (sonner) | Ephemeral confirmations (`success`, `error`, `info`) |
| `ConfirmDialog` (uses `AlertDialog`) | Destructive-action confirmation with required reason input |

## Overlays

| Component | Rule |
|---|---|
| shadcn `Dialog` | Modal work; max 2 nested |
| shadcn `Sheet` (side drawer) | Right-side detail/edit; widths per responsive spec |
| shadcn `Popover`, `DropdownMenu`, `Tooltip`, `Command` | Radix-based, ARIA correct out of the box |

## Navigation

| Component | Rule |
|---|---|
| shadcn `Sidebar` | App-shell nav; collapses to icon rail below `lg` |
| shadcn `Breadcrumb` | Only when depth ≥ 3 or context isn't obvious |
| shadcn `Tabs` | Section switcher within a page; use scroll-overflow variant on narrow viewports |
| `NotificationBell` | `src/components/notification-bell.tsx` — global bell |

## Domain surfaces (to consolidate in Phase A)

| Component | Purpose |
|---|---|
| `Timeline` | Activity / lifecycle line — used by admin match detail + candidate application detail |
| `ActivityFeed` | Chronological stream |
| `MessageThread` | Chat surface; shared by client/admin/candidate |
| `NotificationList` | Notification bell + `/notifications` page |
| `AuditEntry` | Rendering for one `audit_events` row |

Any duplicate implementation of the above is a merge blocker.

## Import contract

Every page imports display primitives from `@/components/ds` and interaction primitives from `@/components/ui/*`. Direct imports of Radix or arbitrary DOM primitives are permitted only inside `src/components/ds/*` and `src/components/ui/*`.

## CI checks

- `scripts/lint-ds-imports.ts` — bans `text-white|bg-black|bg-gray-*|text-slate-*|bg-\[#` in `src/**/*.tsx`.
- `scripts/lint-ds-imports.ts` — bans re-implementations of `StatusBadge`, `KpiCard`, `EmptyState`, `ErrorState` outside `src/components/ds/`.

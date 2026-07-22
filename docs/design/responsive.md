# TaaSFlow — Responsive Specification

Tailwind v4 breakpoints (uses default `sm|md|lg|xl|2xl`). Named viewports we design and QA against:

| Viewport | Tailwind | Class of device |
|---|---|---|
| 320 | below `sm` | Small phone (iPhone SE) |
| 375 | below `sm` | Standard phone |
| 768 | `md` | Tablet portrait |
| 878 | `md` | Editor preview default |
| 1024 | `lg` | Small laptop / tablet landscape |
| 1280 | `xl` | Standard desktop |
| 1440 | `xl` | Large desktop |
| 1920 | `2xl` | Wide desktop |

Every dashboard route MUST be visually correct at all 8 widths.

## Global shell

| Concern | ≤ md (0–767) | md–lg (768–1023) | ≥ lg (1024+) |
|---|---|---|---|
| Sidebar | Off-canvas Sheet, triggered by `SidebarTrigger` in the header | Off-canvas Sheet | Persistent 240px rail, collapsible to 56px icon rail |
| Header | Sticky, contains trigger + brand + notification bell | Same + breadcrumb | Same, breadcrumb visible |
| Page gutters | `px-4` | `px-6` | `px-8` |
| Page max width | 100% | 100% | 1400px centered |

## Component behavior

### KPI grid
- 320–639: single column (`grid-cols-1`), cards full width, stack vertically.
- 640–1023 (`sm`): 2 columns.
- 1024+ (`lg`): 4 columns.

### Tables
- ≥ md: shadcn `<Table>` unchanged, horizontal overflow inside `overflow-x-auto` wrapper.
- < md: transform to a stacked card list (`<div>` per row) — one label:value pair per line. Achieved via the `<ResponsiveTable>` wrapper (to add in Phase A). Never allow a raw table to horizontal-scroll on mobile.

### Filter bar
- ≥ lg: filters inline in one row, primary search 320px wide.
- md–lg: filters wrap; search full width.
- < md: collapse into a "Filters" `Sheet` opened by a button; only the search stays inline.

### Kanban board
- ≥ xl: all columns visible, `overflow-x-auto` only if columns exceed viewport.
- md–xl: horizontal scroll with snap (`snap-x snap-mandatory`) and column width `w-[320px]`.
- < md: switch to accordion-of-columns (single column visible at a time via tabs).

### Side drawer (`Sheet`)
- < md: `w-full` (full-screen).
- md–lg: `w-[440px]`.
- ≥ lg: `w-[520px]` for detail; `w-[640px]` for editors.

### Modal (`Dialog`)
- < md: full-screen (`h-dvh w-full`).
- md–lg: `max-w-lg`.
- ≥ lg: `max-w-2xl` for standard, `max-w-4xl` for structured editors.

### Card wrapping
- Cards inside a section grid wrap using `grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.
- Card content NEVER truncates the primary title without a tooltip — use `truncate` + `title` attr.

### Tab overflow
- ≥ md: tabs render inline.
- < md: tabs container adds `overflow-x-auto snap-x` with fade-out gradient on the right edge.

### Touch targets
- All interactive elements ≥ 44×44 CSS px on viewports < md.
- shadcn `Button` default (`h-9` = 36px) is bumped with `min-h-11 min-w-11 md:min-h-9 md:min-w-9` on mobile-critical actions (primary CTA, icon buttons in the header, Kanban card actions).

### Header/subheader rows containing both text and widgets
Always use the responsive grid pattern documented in the shared responsive-layout knowledge:
```
grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between
```
Every text container gets `min-w-0`, every fixed widget gets `shrink-0`, every single-line title gets `truncate`. `PageHeader` already applies this.

## QA sweep

`e2e/responsive.spec.ts` (to add in Phase A) navigates authenticated snapshots of admin, client, and candidate index pages across all 8 widths and compares against Playwright golden images. Diff > 0.5% pixels fails the run.

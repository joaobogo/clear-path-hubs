# Responsive Rules — TaaSFlow V2

Every route must pass the acceptance checks at each breakpoint below. Test via `preview_ui--set_preview_device_viewport` (mobile / tablet / desktop) and manually resize between them for the intermediate widths.

## Breakpoints and targets

| Width | Class of device | Layout expectation |
|---|---|---|
| **320px** | Small phones | Single column; sidebar hidden behind Sheet; page header stacks (title above actions); tables become `ds/ListView` cards. |
| **375px** | Standard phones | Same as 320. All tap targets ≥ 44×44. No horizontal scroll except designed carousels. |
| **768px** | Tablets (portrait) | Two-column allowed for KPI grid (2×2). Sidebar still hidden; hamburger visible. `PageHeader` may switch to `flex justify-between`. |
| **1024px** | Tablets (landscape) / small laptop | Sidebar appears in expanded form (16rem). Main content max-width applies. KPI grid 3-up. |
| **1280px** | Standard laptop | Sidebar expanded. KPI grid 4-up. Kanban shows all pipeline columns. |
| **1440px** | Desktop | Content max-width `max-w-screen-2xl mx-auto`. Right rail visible in `RecordDetail`. |
| **1920px** | Large desktop | Same as 1440; excess width becomes side gutters. **Never** stretch a table full-bleed; cap width to keep row length readable. |

## Layout patterns

### Multi-item header rows

Follow the responsive-layout-patterns rule (see `responsive-layout-patterns` knowledge card):

```tsx
<header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
  <div className="flex min-w-0 items-center gap-3">
    <Avatar className="shrink-0" />
    <h1 className="truncate text-xl font-semibold sm:text-2xl">{title}</h1>
  </div>
  <ActionGroup />
</header>
```

Rules: two-column grid with `minmax(0,1fr)_auto` on mobile → `flex` at `sm:`; every flex text container has `min-w-0`; fixed icons/avatars use `shrink-0`; single-line headings use `truncate`.

### Tables → lists

`ds/DataTable` renders a `<table>` at ≥md and a `ds/ListView` (card-per-row) at <md. Consumers do not opt in — the component does the swap.

### Kanban

- ≥xl: all columns visible, horizontal scroll inside the board container only.
- <xl and ≥md: horizontal scroll snap between columns.
- <md: switch to a stage `Pipeline` chip + single-column list of that stage's cards. Stage switching via the pipeline rail.

### Split view

`ds/SplitView` renders master + detail side-by-side at ≥md. At <md, master is the route and detail is a full-screen sub-route (`/positions` → `/positions/$id`).

### Drawer vs Modal

- Drawer (right sheet) for record editing that benefits from context (activity, notes visible under the drawer). Width `max-w-2xl` on desktop, full-width on mobile.
- Modal for atomic decisions (confirm, quick create). Width `max-w-md` default.

## Viewport-specific rules

- `h-dvh`, not `h-screen`, for any full-height container. Mobile browser chrome resizes viewport.
- Bottom-fixed action bars (mobile forms) respect `pb-[env(safe-area-inset-bottom)]`.
- Never use `100vw` — use `w-full` inside a bounded container.
- No horizontal overflow on any page at any breakpoint. Verify with `document.documentElement.scrollWidth === document.documentElement.clientWidth`.

## Acceptance checklist (per route)

For every route, before shipping:

1. Renders correctly at 320 / 375 / 768 / 1024 / 1280 / 1440 / 1920.
2. `PageHeader` renders one primary action and up to three secondaries; overflow menu present when needed.
3. No horizontal scroll except inside designed carousels/Kanban.
4. No tap target < 44×44 on any mobile viewport.
5. Sidebar hidden on <lg; Sheet trigger present.
6. Tables collapse to `ListView` on <md.
7. All text uses semantic color tokens; no `text-gray-*` / `text-white`.
8. All icon-only buttons have `aria-label` + `Tooltip`.
9. Keyboard: Tab through the page front-to-back; focus visible on every stop.
10. `Esc` closes any open drawer/modal/popover and returns focus to the trigger.

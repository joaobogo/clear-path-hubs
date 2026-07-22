# TaaSFlow — Design Tokens

**Source of truth:** `src/styles.css`. Every token is a CSS custom property registered under `@theme inline`, generating Tailwind utilities (`bg-*`, `text-*`, `border-*`). Components MUST use utility classes tied to tokens — never arbitrary hex, never inline colors.

## Color tokens

Semantic (used everywhere):

| Token | Utility | Purpose |
|---|---|---|
| `--background` / `--foreground` | `bg-background text-foreground` | Page canvas + default text |
| `--card` / `--card-foreground` | `bg-card` | Elevated surfaces |
| `--muted` / `--muted-foreground` | `bg-muted text-muted-foreground` | Secondary UI, hints, captions |
| `--primary` / `--primary-foreground` | `bg-primary` | Primary actions |
| `--secondary` | `bg-secondary` | Secondary surfaces |
| `--accent` | `bg-accent` | Hover/active states |
| `--border` / `--input` / `--ring` | `border-border`, `ring-ring` | Structure |
| `--success` / `--success-soft` | `bg-success`, `bg-success-soft text-success` | Active, healthy, done |
| `--warning` / `--warning-soft` | `bg-warning`, `bg-warning-soft` | Needs attention |
| `--info` / `--info-soft` | `bg-info`, `bg-info-soft text-info` | In progress, informational |
| `--destructive` / `--danger-soft` | `bg-destructive`, `bg-danger-soft` | Failure, delete |

All colors defined in `oklch` for perceptual uniformity and dark-mode parity. Both `:root` and `.dark` sets are complete.

**Forbidden:** `text-white`, `bg-black`, `bg-gray-*`, `text-slate-*`, `bg-[#…]`. CI grep fails builds on `bg-\[#` and `text-(gray|slate|zinc|neutral|stone)-`.

## Typography scale

Tailwind default type-scale + these rules:

| Role | Class | px | Weight |
|---|---|---|---|
| Display / H1 | `text-2xl sm:text-3xl font-semibold tracking-tight` | 24 → 30 | 600 |
| Section / H2 | `text-xl font-semibold tracking-tight` | 20 | 600 |
| Subsection / H3 | `text-base font-semibold` | 16 | 600 |
| Body | `text-sm text-foreground` | 14 | 400 |
| Caption / hint | `text-xs text-muted-foreground` | 12 | 400 |
| Section label | `text-xs font-medium uppercase tracking-wide text-muted-foreground` | 12 | 500 |
| Numeric readouts | add `tabular-nums` | | 600 |

Font family = system stack (Tailwind default). No web font in v1.

## Spacing scale

Tailwind default 4pt scale (`gap-2` = 8, `gap-4` = 16). Codified rhythm:

- Card padding: `p-5` (20)
- Section vertical gap: `space-y-6` (24)
- Form field gap: `space-y-3` (12) inside a card
- Inline control gap: `gap-2` (8)
- Row gap for KPI grid: `gap-4` (16)

## Page widths & grid

- Global page max: `--page-max-w: 1400px` (`max-w-[var(--page-max-w)]`)
- Content-focused pages (forms, articles): `--content-max-w: 72rem` (1152)
- Gutters: `px-4 sm:px-6 lg:px-8`
- KPI grid: `grid gap-4 sm:grid-cols-2 lg:grid-cols-4`
- Two-column workspace: `grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]` (main + drawer)

## Radii

`--radius: 0.625rem` (10px) drives the scale:

| Utility | Value | Use |
|---|---|---|
| `rounded-sm` | 6px | Chips, inputs |
| `rounded-md` | 8px | Buttons |
| `rounded-lg` | 10px | Cards, dialogs default |
| `rounded-xl` | 14px | KPI cards, drawers |
| `rounded-full` | pill | Badges, avatars |

## Borders

Single canonical border: `border border-border`. Dashed variant `border-dashed` reserved for empty-state and drop zones. No custom border widths above 1px except focus rings.

## Shadows / elevation

Three-step system defined in `styles.css`:

- `shadow-[var(--shadow-elevation-1)]` — resting cards, KPI
- `shadow-[var(--shadow-elevation-2)]` — hovered/interactive cards, popovers
- `shadow-[var(--shadow-elevation-3)]` — dialogs, drawers

No `shadow-2xl`, no glow effects.

## Motion

- `--motion-fast: 120ms` — hover, focus, tap
- `--motion-base: 180ms` — dropdown, tab switch
- `--motion-slow: 280ms` — drawer, dialog
- Standard easing: `--ease-standard: cubic-bezier(0.2,0,0,1)`

Every animated element MUST respect `motion-reduce:` (skeletons already do).

## Icons

Lucide only, imported per-icon. Sizes: `h-4 w-4` inline, `h-5 w-5` in buttons/section headings, `h-6 w-6` in empty/error states. Icons are decorative → add `aria-hidden`; when an icon replaces a text label, the parent element gets `aria-label`.

## State conventions

| State | Convention |
|---|---|
| Focus | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background`, never `outline-none` alone |
| Hover | `hover:bg-accent hover:text-accent-foreground` for controls; `hover:border-primary/30 hover:shadow-[var(--shadow-elevation-2)]` for cards |
| Active/selected | `data-[state=active]:bg-primary data-[state=active]:text-primary-foreground` (Radix) |
| Disabled | `disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed` |
| Loading | `<Skeleton />` for placeholders; button spinner uses `Loader2` icon + `disabled` |
| Success | `StatusBadge tone="success"`; toast `variant="default"` with success icon |
| Warning | `StatusBadge tone="warning"`; toast neutral tone |
| Error | `<ErrorState>` for pages; `StatusBadge tone="danger"` inline; toast `variant="destructive"` |

## Enforcement

- ESLint rule `no-restricted-syntax` bans literal color utilities (`text-white`, `bg-black`, `bg-gray-*`, `text-slate-*`).
- Visual regression suite (see `docs/design/visual-regression.md`) fails PRs whose token deltas exceed thresholds.

# TaaSFlow Design System

A single source of truth for the TaaSFlow product and marketing surfaces.
The tokens preserve the current premium visual direction — editorial serif
headings, restrained navy/blue palette, professional tone, clean workspace
styling — and formalize them so surfaces cannot drift.

Live gallery (Platform Admin only): **/admin/design-system**

## Layers

1. **`src/styles/brand-tokens.css`** — `--brand-*` (public) and `--taas-*`
   (canonical) tokens. Single source. Never redeclare in a component.
2. **`src/styles.css`** — shadcn/Tailwind bridge. Maps `--taas-*` into
   Tailwind utilities and shadcn semantic names.
3. **`src/styles/density.css`** — `data-density="compact"` scope for
   data-heavy screens.
4. **`src/styles/motion.css`** + **`industry-motion.css`** — motion tokens.
5. **`src/components/ds/*`** — shared workspace primitives (`StatusBadge`,
   `PageHeader`, `KpiCard`, `EmptyState`, `ErrorState`, `Skeleton`,
   `DashboardCard`, `ScoreDisplay`, `StageIndicator`,
   `RequirementCoverage`, …).

## Canonical rules

- **No custom colors in components.** Use Tailwind tokens
  (`bg-primary`, `text-muted-foreground`, `border-border`, `bg-success-soft`
  …) or the `--taas-*` variables. Never `bg-[#…]`, `text-white`, or
  `text-black`.
- **Status meanings never change page to page.**
  - `success` — completed, hired, positive movement.
  - `warning` — needs attention / stalled but recoverable.
  - `danger` / `destructive` — failed, rejected, blocking.
  - `info` — informational, in progress, neutral action.
  - `neutral` — inactive / archived / not started.
- **One padding / height scale.** Buttons: `sm=h-8`, `default=h-9`,
  `lg=h-10`. Inputs default to `h-9`. Cards use `--taas-density-card-p`.
- **Focus states are always visible.** Global rule in `brand-tokens.css`
  applies `--brand-focus-ring` to every focusable element.
- **Long content never breaks layout.** `overflow-wrap: anywhere` is set
  globally on text nodes; tables use `min-w-0 truncate` per column when
  needed.
- **No decorative stock photography inside operational dashboards.**
  Marketing surfaces (public shell) may use editorial imagery.

## Density

Wrap any data-heavy region with `data-density="compact"` to activate
tighter row/cell/button heights without changing component APIs.

```tsx
<section data-density="compact">
  <table>…</table>
</section>
```

Comfortable is the default and requires no attribute.

## Surfaces

| Surface       | Container width          | Padding           |
| ------------- | ------------------------ | ----------------- |
| Public site   | `--brand-public-width`   | `brand-section`   |
| Workspace     | `--brand-workspace-width`| PageShell         |
| Long prose    | `--brand-prose-width`    | `brand-section`   |

## Typography

- Display / editorial headings: `--taas-font-display` (Fraunces).
- Body + UI: `--taas-font-sans` (Inter).
- Mono / evidence: `--taas-font-mono` (JetBrains Mono).

## Motion

Use `--taas-motion-{instant,fast,base,slow,slower}` with
`--taas-ease-standard` for interactive changes. Reserve `--taas-ease-emphasized`
for meaningful entrances (dialog open, drawer). Never animate layout at
`slower` on high-frequency events.

## When to add a new component

1. It appears on ≥3 unrelated surfaces.
2. It has ≥3 states (default / hover / focus / loading / empty / error).
3. It has never-varying tokens (color, spacing, radius).

Otherwise inline it. The DS is not a component graveyard.

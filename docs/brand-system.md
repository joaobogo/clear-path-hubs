# TaaSFlow Brand System — Single Source of Truth

One system covers both the public site and the authenticated dashboards.
No surface owns its own tokens. If it's not in here, don't invent it.

## Where tokens live

| Layer                        | File                              |
| ---------------------------- | --------------------------------- |
| shadcn / product semantic    | `src/styles.css` (`:root`, `.dark`, `@theme inline`) |
| Marketing brand tokens       | `src/styles/brand-tokens.css`     |
| Motion tokens (durations, easings, keyframes) | `src/styles/motion.css`      |
| Industry motion accents      | `src/styles/industry-motion.css`  |

`src/styles.css` maps every shadcn variable (`--primary`, `--muted`,
`--sidebar`, status colors, chart colors) onto TaaSFlow tokens (`--taas-*`).
That is why `bg-primary` on a dashboard button and the marketing hero CTA
resolve to the same navy/ocean identity.

## Color

Two families, unified:

- `--taas-brand-*` — product semantic (drives shadcn tokens).
- `--brand-navy | --brand-ocean | --brand-sky | --brand-ink | --brand-paper`
  — marketing surface accents.

State colors are **one interpretation** across surfaces:

| Meaning   | Token                       | Also                              |
| --------- | --------------------------- | --------------------------------- |
| Success   | `--success` / `--success-soft`   | `--brand-success`            |
| Warning   | `--warning` / `--warning-soft`   | `--brand-warning`            |
| Danger    | `--destructive` / `--danger-soft`| `--brand-danger`             |
| Info      | `--info` / `--info-soft`         | `--brand-info` (= ocean)     |

Never hardcode hex, `text-white`, `bg-black`, etc. Use Tailwind semantic
classes (`bg-primary`, `text-muted-foreground`) or
`var(--brand-navy|ocean|sky)` on marketing pages.

## Typography

One scale, one heading family, one body family.

- Display / headings: `--brand-font-display` (marketing) mirrored by shadcn
  defaults on product surfaces.
- Body: system UI stack, tuned for legibility at product density.
- Utility classes:
  - `text-5xl / text-4xl / text-3xl` — hero, section, sub-section.
  - `text-lg / text-base / text-sm / text-xs` — lede, body, secondary,
    label/eyebrow.
  - Eyebrows: `text-xs font-semibold uppercase tracking-[0.14em]`.
- Line-height and tracking follow Tailwind defaults; do not override per
  page.

## Motion

One language across surfaces, defined in `src/styles/motion.css`:

- Durations: `--motion-fast (120ms)`, `--motion-base (180ms)`,
  `--motion-slow (280ms)`.
- Easing: `--ease-standard: cubic-bezier(0.2, 0, 0, 1)`.
- Reveal / stagger / hover-lift primitives are provided as utility classes;
  do not re-implement per component.
- Reduced-motion is honored globally (`prefers-reduced-motion: reduce`).

## Icons

Lucide only. One weight, one size ramp:

- 16px (`h-4 w-4`) — inline with body text, list bullets, badges.
- 20px (`h-5 w-5`) — section headers, buttons.
- 24px (`h-6 w-6`) — hero / featured tiles.

Never mix icon families. Never bring in emoji as UI iconography.

## Score visuals

One interpretation everywhere:

| Score range | Meaning        | Color token       |
| ----------- | -------------- | ----------------- |
| 85 – 100    | Strong fit     | `--success`       |
| 70 – 84     | Qualified      | `--info`          |
| 50 – 69     | Marginal       | `--warning`       |
| 0  – 49     | Below bar      | `--destructive`   |

Score always shows: numeric, coverage %, contradiction badge if any, and
engine version. This is the same on admin, client, and share surfaces.

## State colors

| State                         | Token / class            |
| ----------------------------- | ------------------------ |
| In progress / processing      | `--info` / info-soft badge     |
| Approved / shortlisted / hired | `--success` / success-soft     |
| Needs attention / review      | `--warning` / warning-soft     |
| Blocked / rejected / error    | `--destructive` / danger-soft  |
| Neutral / draft               | `--muted-foreground` on `--muted` |

All chips and badges use the `<Badge variant="...">` component; never inline
color classes for status.

## Layout widths

- Public marketing content: `--brand-public-width` (1200px).
- Authenticated workspace content: `--brand-workspace-width` (1440px).
- Long-form prose (blog, legal, trust): `--brand-prose-width` (720px).

## Rule

If you're about to write `#hex`, `text-white`, `bg-black`, a bespoke easing,
a new icon set, or a new score color — stop and use the token. If the token
doesn't exist yet, add it here first, then in `styles.css` or
`brand-tokens.css`, then use it.

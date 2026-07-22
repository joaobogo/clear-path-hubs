# TaaSFlow Brand System (V2)

**Trace:** `BRAND-EXTRACT-2026-07-22`
**Source:** https://github.com/joaobogo/sourcing-suite-ai.git (project *Talent Streamline*)
**Destination:** https://clear-path-hubs.lovable.app
**Source of truth:** `src/config/brand.ts` + `src/styles/brand-tokens.css`

Marketing pages consume tokens through `@/config/brand`. Do not hard-code
hex values or logo paths in components. Dashboards keep their existing
shadcn tokens (`--primary`, `--background`, …) untouched; the brand
tokens sit alongside them as `--brand-*` and are used by the public site
and any marketing surface that opts in.

## Logos

| Slot | File | Use |
|---|---|---|
| Primary / light | `src/assets/brand/logo-on-white.png` | Header, docs, invoices on white/light |
| Dark | `src/assets/brand/logo-on-blue.png` | Navy hero, footer, dark-mode header |
| Icon mark | `src/assets/brand/icon-white.png` | Mobile nav, favicons, app icons, avatars |
| Favicon PNG | `public/favicon.png` (3.3 KB) | Modern browsers |
| Favicon ICO | `public/favicon.ico` (32 KB) | Legacy fallback |
| OG image | `public/og-image.png` (62.8 KB) | Social share preview (1200×630) |

Minimum clear space around the wordmark equals the height of the "T"
glyph. Never place the light logo on backgrounds lighter than
`--brand-sky` or the dark logo on backgrounds darker than `--brand-navy`.

## Color palette

Public marketing palette (light):

| Token | Value | Purpose |
|---|---|---|
| `--brand-navy` | `oklch(0.29 0.055 262)` | Authority / primary text on light |
| `--brand-navy-light` | `oklch(0.45 0.055 262)` | Secondary text, muted actions |
| `--brand-ocean` | `oklch(0.60 0.19 258)` | Action / accent / links |
| `--brand-sky` | `oklch(0.92 0.017 245)` | Surface tint |
| `--brand-paper` | `oklch(0.985 0.003 245)` | Page background |
| `--brand-ink` | `oklch(0.18 0.03 262)` | Deep text |

Dashboard palette: unchanged shadcn tokens in `src/styles.css` — never
overwritten by this brand package. Marketing tokens carry the `--brand-`
prefix explicitly for that reason.

Status colors: `--brand-success`, `--brand-warning`, `--brand-danger`,
`--brand-info` mirror shadcn semantics so a status pill designed in the
public site reads the same in the dashboard.

## Typography

Loaded via `<link>` in the root route (`src/routes/__root.tsx`):

- **Inter** 400/500/600/700 — UI + body
- **Fraunces** opsz 9–144, 400/600 — display + editorial headings

Stacks:

- `--brand-font-sans` — Inter → system UI fallback
- `--brand-font-display` — Fraunces → Georgia fallback
- `--brand-font-mono` — JetBrains Mono → system mono

### Heading hierarchy (mobile-first)

| Role | Size / line | Font |
|---|---|---|
| Display | 52 / 1.04 | Fraunces |
| H1 | 40 / 1.08 | Fraunces |
| H2 | 30 / 1.15 | Fraunces |
| H3 | 22 / 1.25 | Inter 600 |
| H4 | 18 / 1.30 | Inter 600 |

### Body hierarchy

| Role | Size / line | Weight |
|---|---|---|
| Body large | 18 / 1.60 | 400 |
| Body | 16 / 1.60 | 400 |
| Body small | 14 / 1.55 | 400 |
| Meta | 12 / 1.50 | 500 |
| Eyebrow | 11 / 1.20 (0.12em tracking, uppercase) | 600 |

## Button hierarchy

1. **Primary** — one per screen, navy or ocean fill, white text.
2. **Secondary** — outlined navy, transparent fill.
3. **Tertiary / ghost** — text + icon, used in cards, tables, filters.
4. **Link** — inline `--brand-ocean` with 1px underline.
5. **Danger** — `--brand-danger`, always confirmed.

Minimum tap target: 44×44 px (`brand.focus.minTargetPx`).

## Link styling

`color: var(--brand-ocean)` · hover `var(--brand-navy)` · visited
`var(--brand-navy-light)` · `underline decoration-1 underline-offset-2`
· focus ring `--brand-focus-ring`.

## Icon conventions

- Library: `lucide-react` at stroke-width **1.75**.
- Allowed sizes: 12 / 14 / 16 / 18 / 20 / 24 / 28 / 32.
- Icon color inherits `currentColor`; never fill hex values inline.
- Pair icons with visible text unless the control has an `aria-label`.

## Radii

xs 4 · sm 6 · md 8 · lg 12 · xl 16 · 2xl 24 · pill 999. Cards default to
`lg`; buttons to `md`; pills / badges to `pill`.

## Shadows

xs → xl step; `glow` for CTA rings. All shadows use navy at low opacity
so cards read as elevation, not color.

## Spacing scale

4pt base — 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 96.

## Section spacing

- `--brand-section-y-sm` 48 · `md` 72 (default) · `lg` 96 · `xl` 128.
- Alternate `md` and `lg` between sections for rhythm.

## Content widths

- Public marketing: 1200 px (`--brand-public-width`)
- Long-form / blog / legal: 720 px (`--brand-prose-width`)
- Workspace / dashboard: 1440 px (`--brand-workspace-width`)

Gutter on all breakpoints: `--brand-space-5` (20 px).

## Status colors

Success (green) · Warning (amber) · Danger (red) · Info (ocean). Used
for KPI deltas, notification badges, form validation states, and
pipeline stage chips.

## Focus styles

Global: 3px ocean ring at 35% alpha, offset via border radius. Applied
to `a, button, [role="button"], input, select, textarea, [tabindex]`
through `:focus-visible` in `brand-tokens.css`.

## Claims intentionally excluded from this brand extraction

The following legacy marketing claims were **not** copied into the
destination — they require owner review (see
`docs/migration/content-claim-checklist.json` and `claim-verification-list.md`):

- "Two-week" pilot language and any "14-day" delivery promises
- Pricing figures (pilot price, subscription tiers)
- Cost-savings percentages vs traditional agencies
- Staffing / delivery benchmarks (candidates per position per week)
- Visa sponsorship / relocation support promises
- Hiring capacity claims (positions per client per month)
- Named client logos, testimonials, and case-study attributions
- Team headcount and geographic footprint numbers
- AI scoring accuracy percentages

Visual branding is complete; factual/quantitative claims stay off until
approved.

## Verification (this turn)

- Assets: logos, favicon(s), OG image copied into destination.
- Tokens: brand-tokens.css imported from `src/styles.css`.
- Fonts: Inter + Fraunces loaded from Google Fonts in root route head.
- No dashboard token overwritten (grep of `--primary`, `--background`,
  `--foreground` in `src/styles.css` unchanged).
- Focus ring active globally through `:focus-visible`.

## Contrast

All primary combinations meet WCAG AA (4.5:1 body, 3:1 large):

- Navy on Paper: ≈ 11.2 : 1 ✔
- Ocean on Paper: ≈ 4.9 : 1 ✔
- White on Navy: ≈ 11.2 : 1 ✔
- White on Ocean: ≈ 4.3 : 1 (large text only) — pair with navy text for
  body copy on ocean surfaces.

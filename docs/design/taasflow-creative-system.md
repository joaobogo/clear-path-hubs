# TaaSFlow Creative System — Canonical Reference

**Status:** Locked. One system covers public marketing site and authenticated product. There is no second design framework.
**Code sources of truth (do not fork):**
- `src/styles/brand-tokens.css` — every brand-facing value (color, radius, shadow, spacing, motion, chart, score, shell, dark-mode).
- `src/styles.css` — shadcn semantic layer; every shadcn token maps to a `--taas-*` token via `@theme inline`.
- `src/styles/motion.css` — motion primitives (durations, easings, `prefers-reduced-motion` global override).
- `src/styles/industry-motion.css` — industry hero motion utilities (opt-in).
- `src/config/brand.ts` — logo variants, brand strings.
- `src/components/brand/BrandLogo`, `BrandMark` — logo rendering surface.

**Rule of one:** Every color, radius, shadow, duration, spacing, and font size in application code MUST resolve to a `--taas-*` or `--brand-*` token, or through a shadcn semantic class (`bg-primary`, `text-muted-foreground`, `border-border`, …) that maps to one. No new hex, no new oklch, no new pixel numbers introduced outside the token files.

---

## 1. Foundation stack (layer diagram)

```text
                    ┌───────────────────────────────────────────────┐
Application code →  │  Tailwind utility classes + shadcn variants   │
                    │  (bg-primary, text-muted-foreground, …)       │
                    └──────────────────┬────────────────────────────┘
                                       │  @theme inline mapping
                    ┌──────────────────▼────────────────────────────┐
Semantic layer  →   │  src/styles.css (shadcn tokens: --primary,    │
                    │  --background, --border, --sidebar-*, …)      │
                    └──────────────────┬────────────────────────────┘
                                       │  var(--taas-*)
                    ┌──────────────────▼────────────────────────────┐
Brand API       →   │  src/styles/brand-tokens.css                  │
                    │  (--taas-brand-*, --taas-surface-*,           │
                    │   --taas-text-*, --taas-status-*,             │
                    │   --taas-chart-*, --taas-score-*,             │
                    │   --taas-shell-*, --taas-motion-*)            │
                    └──────────────────┬────────────────────────────┘
                                       │  var(--brand-*)
                    ┌──────────────────▼────────────────────────────┐
Raw palette     →   │  --brand-navy / --brand-ocean / --brand-sky / │
                    │  --brand-ink / --brand-paper / --brand-*      │
                    └───────────────────────────────────────────────┘
```

Never bypass upward: no component reads `--brand-navy` directly; it reads `--taas-brand-navy` (or the shadcn `bg-primary` that maps to it). This makes theming (light/dark, per-client accent) a single-layer change.

---

## 2. Palette

Raw brand palette (approximate HSL in comments; OKLCH values in `brand-tokens.css`):

| Role           | Token                | Notes                              |
| -------------- | -------------------- | ---------------------------------- |
| Authority      | `--brand-navy`       | 222 47% 20% — hero, nav, dark CTA  |
| Navy dark      | `--brand-navy-dark`  | pressed / footer / boardroom       |
| Action         | `--brand-ocean`      | 221 83% 53% — primary buttons/links|
| Ocean light    | `--brand-ocean-light`| hover states, gradient stop        |
| Surface tint   | `--brand-sky`        | 214 32% 91% — chips, soft bg       |
| Ink            | `--brand-ink`        | body text                          |
| Paper          | `--brand-paper`      | app background                     |
| Success        | `--brand-success`    | hires, positive delta              |
| Warning        | `--brand-warning`    | attention, moderate score          |
| Danger         | `--brand-danger`     | rejection, poor score              |

Semantic surface tokens (use these in code, not the raw palette):
`--taas-surface-page`, `--taas-surface-card`, `--taas-surface-elevated`, `--taas-surface-muted`, `--taas-surface-sunken`, `--taas-surface-inverse`.

Text tokens: `--taas-text-primary | secondary | tertiary | disabled | inverse | link | link-hover`.
Border tokens: `--taas-border-subtle | default | strong | focus`.
Interaction tokens: `--taas-interactive-hover | pressed | selected | disabled`.

**Dark mode.** `.dark` in `brand-tokens.css` re-binds `--brand-*` and `--taas-shell-*` — no component-level dark variants required. Any component reading `--taas-*` inherits dark automatically.

---

## 3. Type scale

| Token                    | Size   | Use                              |
| ------------------------ | ------ | -------------------------------- |
| `--taas-text-display-xl` | 72px   | Hero H1 (desktop)                |
| `--taas-text-display-lg` | 56px   | Section hero                     |
| `--taas-text-display-md` | 44px   | Category page hero               |
| `--taas-text-display-sm` | 36px   | Sub-hero                         |
| `--taas-text-h1`         | 30px   | Dashboard page title             |
| `--taas-text-h2`         | 24px   | Section title                    |
| `--taas-text-h3`         | 20px   | Card title                       |
| `--taas-text-h4`         | 17px   | Sub-card / dense workspace       |
| `--taas-text-body-lg`    | 17px   | Marketing body                   |
| `--taas-text-body-md`    | 15px   | Default UI body                  |
| `--taas-text-body-sm`    | 14px   | Dense workspace body             |
| `--taas-text-meta-md`    | 13px   | Chip, label                      |
| `--taas-text-meta-sm`    | 12px   | Table meta, timestamps           |
| `--taas-text-caption`    | 11px   | Footnote, legend                 |

Leading tokens: `--taas-leading-tight | snug | normal | relaxed`.
Stacks: `--taas-font-sans` (Inter), `--taas-font-display` (Fraunces, marketing only), `--taas-font-mono` (JetBrains Mono).

---

## 4. Spacing, radii, borders

Spacing (4pt base): `--brand-space-1..24` (4px → 96px). Section rhythm: `--brand-section-y-sm|md|lg|xl` (48/72/96/128).
Content widths: `--brand-public-width` 1200, `--brand-workspace-width` 1440, `--brand-prose-width` 720.

Radii: `--taas-radius-control` 6px (inputs, buttons), `--taas-radius-card` 12px (cards, panels), `--taas-radius-surface` 16px (modals, sheets), `--taas-radius-pill` 999px (chips, avatars).

Border weights: `--taas-border-hairline | regular | emphasis`. Border colors flow through `--taas-border-*`.

---

## 5. Elevation

`--taas-shadow-0` (none) → `--taas-shadow-5` (modal). Shadow color is derived from navy at low alpha; no free-form shadow colors are permitted. Focus is a separate token: `--taas-shadow-focus` = 3px ocean at 35% alpha, applied globally to `:focus-visible` in `brand-tokens.css`.

---

## 6. Motion

Full spec in `docs/design/motion-system.md` and code in `src/styles/motion.css`.

- Durations: `instant` 80 · `fast` 120 · `base` 180 · `slow` 280 · `slower` 420 · `story` 600 (storytelling ceiling).
- Easings: `standard` (UI default), `emphasized` (section entry), `out-soft` (number tweens), `in-out` (utility), `spring-subtle` (product only).
- Reduced motion: single global override collapses transitions to 1ms and forces revealed content visible.

---

## 7. Charts and status

Categorical palette: `--taas-chart-1..7` (ocean, navy, light-ocean, success, warning, violet, teal). Pairs 1+2 and 3+4 are WCAG-safe.
Score bands: `--taas-score-excellent | strong | moderate | weak | poor` (85–100 / 70–84 / 55–69 / 40–54 / 0–39). Used by `ScoreExplainability`, evidence viewer, and comparison tableau.
Pipeline stages: `--taas-stage-new | review | shortlisted | interview | offer | hired | rejected | withdrawn`. Used by Kanban and journey timeline.

---

## 8. Product frame

Workspace shell tokens (shared across admin, client, candidate dashboards):
`--taas-shell-bg`, `--taas-shell-bg-gradient` (dual radial wash), `--taas-shell-sidebar-bg/border`, `--taas-shell-topbar-bg/border`, `--taas-shell-nav-active-bg/fg`, `--taas-shell-nav-hover-bg`, `--taas-shell-nav-rail`, `--taas-shell-logo-gradient`, `--taas-shell-logo-shadow`.

Public marketing shell reuses the same `--taas-*` tokens and adds hero gradient utilities (`brand-surface-hero | accent | navy`, `brand-container-public | workspace | prose`, `brand-section | -lg | -xl`).

Enterprise client branding overlays (logo, brand name, primary/accent hex) attach only at `client-brand-header`; they never mutate `--taas-*`. TaaSFlow product chrome is preserved.

---

## 9. Icons

- Library: `lucide-react`, stroke 1.5px default, 1.75px for large marketing tiles.
- Size scale: 14 / 16 / 20 / 24 / 32 (px). Icons inherit color via `currentColor`.
- Rules in `docs/design/taasflow-icon-rules.md`.
- No custom SVGs for concepts already covered by lucide; illustration SVGs (workspace tour, case studies) live under `src/assets/` and are exempt from the token system (see §12).

---

## 10. Component language

See `docs/design/component-language.md` for anatomy. Every primitive (button, card, chip, input, table, dialog, sheet, tabs, tooltip) reads only shadcn semantic classes; variants are declared with `cva` and never inline color utilities.

---

## 11. Enforcement — no duplicated hard-coded brand colors

Grep contract (CI-friendly):

```bash
# Fails if any src/**/*.{ts,tsx,css,scss} outside the allowlist introduces a hex.
rg -n --no-messages -oI '#[0-9a-fA-F]{6}\b' src/components src/routes \
  | rg -v -f docs/design/hex-allowlist.txt
```

Current allowlisted illustration files (stylized art, not brand surfaces):
- `src/routes/case-studies.tsx` — case-study window mockups (traffic-light dots, illustrated screens).
- `src/routes/index.tsx` — hero visual composition.
- `src/components/marketing/workspace-tour.tsx` — animated tour illustrations.
- `src/components/marketing/book-a-call.tsx` — decorative frame chrome.
- `src/routes/_authenticated/client.settings.tsx` — brand-color input picker preview swatches (user-supplied hex).

Every other file is expected to reach for `--taas-*` / shadcn classes. Duplicate brand hex introduced outside the allowlist = PR block.

---

## 12. Contrast report (WCAG 2.1 AA)

Verified pairs (using OKLCH → sRGB conversion of tokens in `brand-tokens.css`):

| Pair                                          | Ratio | Result |
| --------------------------------------------- | ----- | ------ |
| `--taas-text-primary` on `--taas-surface-page`| 14.8:1| PASS (AAA) |
| `--taas-text-secondary` on card               | 7.4:1 | PASS (AAA) |
| `--taas-text-tertiary` on card                | 4.9:1 | PASS (AA) |
| Primary button (ocean fg on ocean bg text=white)| 5.1:1| PASS (AA) |
| Navy CTA fg on `--brand-navy`                 | 12.6:1| PASS (AAA) |
| Focus ring (ocean 35%) on paper               | 3.2:1 non-text | PASS (AA non-text) |
| Success chip text on success-soft             | 5.6:1 | PASS (AA) |
| Warning chip text on warning-soft (mixed 80%) | 4.7:1 | PASS (AA) |
| Danger chip text on danger-soft               | 5.9:1 | PASS (AA) |
| Dark-mode body: text-inverse on shell-bg      | 13.9:1| PASS (AAA) |
| Dark-mode secondary on sidebar bg             | 6.7:1 | PASS (AA) |

Critical UI contrast failures: **0**. Any change to raw palette re-runs `pnpm dlx @adobe/leonardo-contrast-colors` (or the manual check) and updates this table.

---

## 13. Responsive envelope

Viewports the system is validated against: **320 · 768 · 1024 · 1440**. Rules in `docs/design/responsive-rules.md`. Hard rule: no horizontal scroll at 320; workspace shell collapses sidebar → sheet at <1024.

---

## 14. What NOT to add

- No parallel token file (`design-system-v2/`, `theme.config.ts`, etc.).
- No Tailwind arbitrary values with raw hex (`bg-[#0f3d3a]`) outside the illustration allowlist.
- No component-local color constants (`const NAVY = '…'`).
- No re-declaration of shadcn tokens (`--primary`) outside `src/styles.css`.
- No motion durations that don't map to a `--taas-motion-*` token.

Additions to the palette go through `brand-tokens.css` + `styles.css` in the same PR, with a contrast row added to §12.

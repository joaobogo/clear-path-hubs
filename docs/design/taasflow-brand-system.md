# TaaSFlow Brand System — Canonical Reference

**Status:** Phase 3 foundation locked.
**Source of truth (code):** `src/config/brand.ts`, `src/styles/brand-tokens.css`, `src/styles.css`.
**Do not** duplicate brand values in components. Always import from `@/config/brand` or reference the CSS variables it exposes.

---

## 1. Identity

| Field         | Value                                     |
| ------------- | ----------------------------------------- |
| Name          | TaaSFlow                                  |
| Tagline       | Talent as a Service                       |
| Domain        | clear-path-hubs.lovable.app               |
| Voice         | Professional, evidence-first, direct.     |
| Personality   | Authoritative navy, decisive ocean-blue accents, calm paper surfaces. |

## 2. Logo variants

Assets: `src/assets/brand/`

| Variant           | File               | Use                                                          |
| ----------------- | ------------------ | ------------------------------------------------------------ |
| Full — light bg   | `logo-on-white.png` | Public header, workspace sidebar (expanded), auth screens.  |
| Full — dark bg    | `logo-on-blue.png`  | CTA sections, dark-mode headers, footer over navy.          |
| Icon              | `icon-white.png`    | Collapsed sidebar, mobile nav, favicons, email header icon. |

Rendered exclusively through `@/components/brand/BrandLogo` and `BrandMark`.
Never inline `<img src="/assets/...">` or import brand PNGs directly in feature code.

## 3. Color system

See `taasflow-color-tokens.json`. Palette anchors:

- **Navy** `var(--brand-navy)` — authority, headings on light, primary surfaces on dark.
- **Ocean** `var(--brand-ocean)` — action, links, primary CTA.
- **Sky** `var(--brand-sky)` — quiet surface, section dividers.
- **Ink / Paper** — body text / default background.
- **Semantic**: success, warning, danger, info — shared between public and workspace so status reads the same everywhere.

Rules:
- Never hardcode hex/oklch in components. Use tokens.
- Never encode status by color alone — pair with an icon or label (`StatusBadge`).
- Never use ocean and info for two different meanings — they are the same token.

## 4. Typography

Fonts loaded via `<link>` in `src/routes/__root.tsx` (Google Fonts CDN, self-hosting deferred).

| Family    | Stack alias              | Use                                    |
| --------- | ------------------------ | -------------------------------------- |
| Inter     | `--brand-font-sans`      | All UI, body, workspace, forms.        |
| Fraunces  | `--brand-font-display`   | Public hero display, editorial titles. |
| Mono      | `--brand-font-mono`      | Reference IDs, code snippets.          |

Scale defined in `brand.typography.scale` (`display`, `h1`–`h4`, `bodyLg`, `body`, `bodySm`, `meta`, `eyebrow`). No ad-hoc font sizes.

## 5. Spacing, radius, shadow, layout

See `taasflow-layout-tokens.json`. 4-pt spacing scale, six-step radius (`xs`→`2xl` + `pill`), five-step shadow ladder (`xs`→`xl` + `glow`), three container widths (`public 1200`, `workspace 1440`, `prose 720`).

## 6. Icons

Library: `lucide-react` only. Stroke width **1.75**. Approved sizes: 12, 14, 16, 18, 20, 24, 28, 32.
Icon-only buttons require `aria-label`. Decorative icons must set `aria-hidden`.

## 7. Focus, motion, accessibility

- Focus ring: `var(--brand-focus-ring)`. Never remove without an equivalent replacement.
- Minimum tap target: 44px.
- Respect `prefers-reduced-motion` for all page transitions.
- Contrast: body copy ≥ 4.5:1; large text ≥ 3:1; focus ring ≥ 3:1 against adjacent color.

## 8. Governance

- One brand config: `src/config/brand.ts`.
- One token layer: `src/styles/brand-tokens.css` (additive to shadcn tokens in `src/styles.css`).
- Component contracts: `src/components/ds/*` (StatusBadge, KpiCard, PageHeader, Section, EmptyState, ErrorState, Skeletons).
- Public shells: `src/components/marketing/site-shell.tsx`, `form-shell.tsx`.
- Logo renderer: `src/components/brand/BrandLogo.tsx`.

## 9. What Phase 3 did not do

Phase 3 did not redesign pages, alter navigation architecture, or change any operational behavior. See `reports/phase-3/brand-regression-results.md` for the guarantee list.

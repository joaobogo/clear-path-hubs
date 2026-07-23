# TaaSFlow Logo Usage

**Renderer:** `@/components/brand/BrandLogo` and `@/components/brand/BrandMark`.
**Never** inline `<img src="/assets/brand/...">` in feature code.

## Variants

| Variant   | Component / prop                        | Use                                       |
| --------- | --------------------------------------- | ----------------------------------------- |
| Full      | `<BrandLogo variant="full" />`          | Public header, footer, auth screens.      |
| Compact   | `<BrandLogo variant="compact" />`       | Reserved for stacked lockups.             |
| Icon      | `<BrandLogo variant="icon" />` or `<BrandMark />` | Collapsed sidebar, mobile nav, favicons, email header. |

## Backgrounds

- `background="light"` → uses `logo-on-white.png`. Use on white / paper / sky.
- `background="dark"` → uses `logo-on-blue.png`. Use on navy / navy-dark / gradient CTA.

Test each placement on: **white, brand ocean, brand navy, neutral gray, mobile header, collapsed sidebar, email-width container**.

## Sizes

- Public header: `height={32}`
- Public footer: `height={24}`
- Auth / form shell: `height={28}`
- Workspace sidebar expanded: `height={28}`
- Workspace sidebar collapsed: BrandMark `size={24}`
- Mobile header: `height={24}`
- Email header: `height={32}`

## Do
- Preserve aspect ratio — set `height`, let width auto.
- Provide accessible name via `label` prop, or `decorative` when adjacent text repeats the brand name.
- Keep at least the icon's height of clear-space around the logo.

## Do not
- Do not stretch, skew, rotate, or recolor.
- Do not place the light logo on dark surfaces or vice versa.
- Do not render below 16px height — use the icon mark instead.
- Do not hotlink from the old website domain.
- Do not use logo in place of BrandMark inside 1:1 avatar circles.

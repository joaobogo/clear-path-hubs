# Brand Inventory — TaaSFlow V2

Read-only inventory. Source: `https://sourcing-suite-ai.lovable.app` (parent brand `https://taasflow.com`). Destination: `https://clear-path-hubs.lovable.app`. No dashboard/DB/auth/intake/scoring code is modified in this phase.

## 1. Logo variants

| Variant | Source location | Destination status | Decision |
|---|---|---|---|
| Wordmark (color, light bg) | `taasflow.com` header | not staged in `public/` | MIGRATE — download from source, upload via `lovable-assets`, reference from `SiteShell` header. |
| Wordmark (mono, dark bg) | inferred from footer | not staged | MIGRATE_AND_IMPROVE — derive from wordmark if not shipped. |
| Icon / brand mark | not distinguishable on source | absent | REWRITE_FOR_V2 — commission a square mark for favicon + app icon. |
| Founder headshots (Joao, Christian) | source `/about` | `src/assets/joao.jpg.asset.json`, `src/assets/christian.jpg.asset.json` | MIGRATE_EXACTLY (already on CDN). |

## 2. Favicon

- **Current state:** `public/favicon.png` is a transitional placeholder (Lovable default variant). `og-image.png` is also placeholder.
- **Decision:** REWRITE_FOR_V2 once brand mark exists; then follow `updating-the-favicon` skill and delete the placeholder in the same commit.

## 3. Colors, gradients, backgrounds

Source system observed on `taasflow.com` (approximate — sampled by eye from rendered pages; verify against a source style token dump if the source repo is available).

| Token | Observed value | V2 handling |
|---|---|---|
| Primary | teal/cyan `~#0EA5A4` | RETAINED in `src/styles.css` OKLCH tokens under `--primary`. |
| Accent | violet gradient stops `~#7C3AED → #0EA5A4` | RETAINED as `--accent` + `--gradient-hero` in design system. |
| Neutral surface (light) | near-white `~#F8FAFC` | MIGRATE_EXACTLY — matches V2 `--background`. |
| Neutral surface (dark) | slate `~#0F172A` | MIGRATE_EXACTLY — matches V2 `--foreground` inverse. |
| Success / warning / danger | standard semantic set | KEEP — V2 already ships full semantic set. |
| Hero background | soft radial gradient behind hero | REWRITE_FOR_V2 to workspace-first hero. |

**Decision:** MIGRATE_AND_IMPROVE — treat the observed palette as the reference and codify in `src/styles.css` OKLCH tokens (already partially in place). Do not hard-code hex values in components.

## 4. Typography

| Role | Source (observed) | V2 |
|---|---|---|
| Headings | Geist / Inter sans, tight tracking | KEEP — `--font-sans` in design system. |
| Body | Inter | KEEP. |
| Numeric / KPI | tabular Inter | KEEP; ensure `font-variant-numeric: tabular-nums` on KPI cards. |
| Serif accents | none observed | none needed. |

**Decision:** MIGRATE_EXACTLY — reuse `src/components/ds/*` typography scale.

## 5. Iconography

- **Source:** Lucide icons (visible on `/how-it-works`, `/pricing`, industry pages).
- **V2:** already standardized on `lucide-react`.
- **Decision:** MIGRATE_EXACTLY.

## 6. Buttons

Observed source patterns: pill/rounded-lg primary, gradient primary CTA, ghost secondary, outline tertiary.
V2 ships `src/components/ds/Button.tsx` (and shadcn `button`) with matching variants.
**Decision:** MIGRATE_EXACTLY — do not fork a marketing-only button variant.

## 7. Cards

Source uses soft-shadow rounded cards (`~rounded-2xl shadow-sm`), often with gradient border/hairline.
V2 has `src/components/ds/Card.tsx`.
**Decision:** MIGRATE_EXACTLY.

## 8. Spacing, borders, shadows

- Spacing scale: standard 4/8/12/16/24/32/48/64 — matches Tailwind defaults V2 already uses. **KEEP**.
- Borders: 1px hairline on `border-border` semantic. **KEEP**.
- Shadows: `shadow-sm` / `shadow-lg` with subtle color tint. **KEEP**.

## 9. Illustration + photography style

- **Illustration:** minimal, geometric, gradient accents (no mascots). MIGRATE_AND_IMPROVE — reuse where scraped, otherwise commission per section.
- **Photography:** professional, muted, human-centered (founder photos, candidate portraits). MIGRATE_EXACTLY for founder photos; use stock or commission for candidate/team photos (source uses stock that likely lacks resale license — flag as VERIFY).

## 10. Dashboard screenshots

- Source screenshots on `/how-it-works`, `/pricing`, `/enterprise`, home hero all show the **legacy** dashboard.
- **Decision:** REWRITE_FOR_V2 — retake every dashboard screenshot from the V2 preview (`/admin`, `/client`, `/candidate`) and upload via `lovable-assets`. Do not migrate legacy screenshots.

## 11. Social sharing assets

- **og:image / twitter:image:** placeholder `public/og-image.png`. **REWRITE_FOR_V2** with branded hero variant.
- **Per-route og:image:** V2 marketing shell already supports leaf-level og:image via `src/lib/marketing/head.ts`. **KEEP**.

## 12. Public structure

| Element | Source | V2 |
|---|---|---|
| Header | Logo + nav (Solutions, Industries, How It Works, Pricing, Resources, Blog) + Login + primary CTA | MIGRATE_AND_IMPROVE — align nav to V2 route map; CTA to `/get-started`. |
| Footer | 4-column: Product, Company, Resources, Legal + socials + copyright | MIGRATE_EXACTLY — rewire links to V2 destinations. |
| Desktop nav | Horizontal top bar, sticky | MIGRATE_EXACTLY. |
| Mobile nav | Hamburger drawer with same links | MIGRATE_EXACTLY. |
| Announcements | Rotating banner on some pages | EXCLUDE unless PM confirms — usually stale. |
| Primary CTAs | "Start pilot" / "Get started" / "Book demo" / "Apply" | MIGRATE_AND_IMPROVE — wire to `/get-started`, `/intake`, `/jobs`. |
| Forms | Contact form, pilot request, employer intake | REPLACE with V2: `/contact` server fn, `/intake` wizard. |
| Contact info | `hello@taasflow.com` (VERIFY), physical address (VERIFY) | VERIFY — do not publish before confirmation. |
| Social links | LinkedIn (VERIFY), possibly X, YouTube | VERIFY handles before publishing. |

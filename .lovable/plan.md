
# TaaSFlow V2 — Phase 4: Public Website Shell

## Scope

Build ONE canonical public shell (header, footer, mobile menu, layout primitives, breadcrumbs, CTA patterns, utility states) and apply it to public routes. Preserve every operational route (intake, application, job board, auth, dashboards) — only wrap them with new branding shells where appropriate.

## Non-goals (explicit)

- No page content migration
- No dashboard redesign
- No changes to intake / application / scoring / CV / auth business logic
- No new backend code, no new Supabase calls, no analytics vendors
- No source-repo Supabase, hooks, guards, or services imported

## Baseline audit (read-only)

1. Record starting destination SHA, brand tokens present (`src/config/brand.ts`, `src/styles/brand-tokens.css`), logo components (`src/components/brand/*`).
2. Inspect existing shell components:
   - `src/components/marketing/site-shell.tsx`
   - `src/components/marketing/form-shell.tsx`
   - `src/components/workspace/workspace-shell.tsx`
   - Current header/footer, mobile menu, containers
3. Inspect source repo `sourcing-suite-ai` public shell — extract structure and presentation patterns only. Classify anything touching Supabase / auth / dashboards as `REBUILD_FROM_REFERENCE`.
4. Confirm operational routes still resolve: `/intake`, `/jobs`, `/jobs/$id/apply`, `/login`, `/track`, `/admin/*`, `/client/*`, `/candidate/*`.

## Build order

### 1. Navigation model (single source of truth)

`src/config/public-navigation.ts` — primary nav, grouped nav (Solutions, Industries, Resources, About), CTAs, footer groups. Every link references a real destination route. Placeholder routes flagged `hidden: true` and excluded from render.

Primary nav: Solutions · Industries · How It Works · Resources · Jobs · About
Primary CTA: **Start Hiring** → `/intake`
Secondary: **Browse Jobs** → `/jobs` · **Sign in** → `/login`

### 2. Header (`src/components/public/public-header.tsx`)

- Canonical `BrandLogo`
- Sticky w/ stable height (no CLS)
- Radix `NavigationMenu` for accessible dropdowns (keyboard, Escape, click-outside)
- Active route via `useRouterState`
- One dominant CTA
- Mobile trigger opens `PublicMobileMenu`

### 3. Mobile menu (`src/components/public/public-mobile-menu.tsx`)

- Radix `Sheet` (focus trap, focus restore, Escape, scroll-lock)
- Accordion for grouped nav
- Auto-closes on route change (subscribe to router)
- Keeps Start Hiring · Browse Jobs · Sign in visible at bottom

### 4. Footer (`src/components/public/public-footer.tsx`)

Groups: Company · Solutions · Employers · Candidates · Resources · Legal. Only links pointing to real routes render. Brand mark, approved statement, copyright w/ current year. No dead social links.

### 5. Layout primitives (`src/components/public/`)

`public-page-shell.tsx`, `public-page-header.tsx`, `public-page-container.tsx`, `public-section.tsx`, `public-section-header.tsx`, `content-container.tsx`, `article-container.tsx`, `form-container.tsx`, `cta-section.tsx`, `breadcrumbs.tsx`, `page-divider.tsx`, plus utility states (`public-loading-state.tsx`, `public-error-state.tsx`, `public-empty-state.tsx`, `public-not-found-state.tsx`).

`PublicPageShell` composes: skip link → header → `<main id="content">` (scroll restoration, error boundary) → footer. SEO slot via route `head()`.

### 6. Focused operational shells (`src/components/public/focused-shell.tsx`)

Variant used by intake, application, auth, invite, reset, tracking. Shows brand + minimal exit route + optional progress. Wraps existing route components — does NOT replace forms, validators, loaders, or backend calls.

Refactor these routes to consume `FocusedShell` (chrome only):
- `/intake`, `/apply/*` steps
- `/login`, `/signup`, `/reset`, `/invite/*`
- `/track`

### 7. CTA patterns (`src/components/public/cta/*`)

`HeroCTAGroup`, `InlineCTA`, `SectionCTA`, `FinalCTASection`, `TextLinkCTA`, `EmployerCTA`, `CandidateCTA`. Enforce one primary per section; external links get `rel="noopener"` + icon.

### 8. Utility routes

- `src/routes/__root.tsx` — `notFoundComponent` → `PublicNotFoundState` (Home / Jobs / Contact, no auto-redirect)
- Router `defaultErrorComponent` → `PublicErrorState` (retry + trace ID slot, no stack traces)

### 9. Apply shell to preserved public routes

Wrap `/jobs`, `/jobs/$id`, `/about`, `/journey`, `/faq`, `/contact`, `/blog`, `/industries*`, `/candidates*`, `/`, etc. in `PublicPageShell`. No content edits.

### 10. Global behavior

- Router already has `scrollRestoration: true` — verify
- Add `SkipLink` component (focuses `#content`)
- `prefers-reduced-motion` respected in header/menu transitions

## Validation

1. TypeScript + build (harness runs)
2. Playwright regression (headless, no auth needed for public):
   - `/`, `/jobs`, `/jobs/$firstId`, `/intake`, `/login`, `/track`, `/about`, `/contact`, `/404-nonexistent`
   - Viewports: 320 · 375 · 768 · 1024 · 1280 · 1440 · 1920
   - Assert: no horizontal overflow, header/footer present (or focused shell on operational), mobile menu opens/closes/traps focus, skip link reachable via Tab, no console errors
3. Axe-core scan on the same routes; require 0 critical / 0 serious
4. Legacy scan: `rg` for old Supabase refs, old Lovable URLs, `sourcing-suite-ai` imports — must be 0

## Documentation

Write these exactly:
- `docs/design/public-shell-architecture.md`
- `docs/design/public-navigation-map.json`
- `docs/design/public-footer-map.json`
- `docs/design/public-layout-components.json`
- `docs/design/public-cta-system.md`
- `docs/design/focused-operational-shells.md`
- `docs/design/public-utility-states.md`
- `docs/migration/public-shell-source-map.json`
- `docs/migration/public-shell-exclusions.md`
- `reports/phase-4/navigation-test-results.md` + `.json`
- `reports/phase-4/responsive-results.md`
- `reports/phase-4/accessibility-results.md`
- `reports/phase-4/regression-results.md` + `.json`

## Deliverable / PASS criteria

Single canonical Header · Footer · MobileNav · Layout system. All rendered links point to real routes. Operational routes untouched. 0 source operational imports · 0 legacy backend deps · 0 broken shell links · 0 mobile-menu failures · 0 critical/serious a11y · 0 horizontal overflow · 0 build failures.

## Risks / callouts

- Existing `SiteShell` and `FormShell` already exist from earlier phases — I'll **evolve them into the canonical `PublicPageShell` + `FocusedShell` rather than duplicating**, keeping old exports as thin re-exports for one phase to avoid a big-bang rename across dozens of routes.
- Source repo cloning: I'll inspect via raw GitHub reads, not by cloning into the workspace, to keep the tree clean.
- I'll flag any route in the ledger that has no destination page yet as `hidden: true` in nav config rather than shipping placeholder pages.

## Technical details

- Radix primitives (`NavigationMenu`, `Sheet`, `Accordion`) — already in shadcn set
- No new npm dependencies expected
- Tailwind v4 tokens only; zero hardcoded colors
- `<main>` lives in `PublicPageShell` only; route components must not render their own `<main>`
- All `Link` from `@tanstack/react-router`; no `<a href>` for internal routes
- Focused shell routes opt out of full header/footer via a `variant="focused"` prop on the shell they consume

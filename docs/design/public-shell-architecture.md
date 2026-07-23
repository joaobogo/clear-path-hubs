# Public Shell Architecture — TaaSFlow V2

## Purpose

One canonical public shell system used by every public route in the destination.
Operational routes (intake, application, auth, tracking) opt into a **focused**
variant that reduces navigation to keep users on the task.

## Modules

| Path | Role |
|---|---|
| `src/config/public-navigation.ts` | Single source of truth for header, footer, and CTA destinations. |
| `src/components/public/index.ts` | Canonical import barrel — new code imports from here. |
| `src/components/marketing/site-shell.tsx` | Implementation of `PublicPageShell`, `PublicSection`, `Breadcrumbs`, `CtaSection`, `PublicNotFound`, `PublicErrorState`, `PublicLoading`, `SkipNav`. Wired to `public-navigation.ts`. |
| `src/components/marketing/form-shell.tsx` | Implementation of `FocusedShell` — brand + optional progress + exit link only. |
| `src/components/public/public-page-header.tsx` | Reusable `<h1>` block with eyebrow, description, and action slots. |
| `src/components/public/public-empty-state.tsx` | Neutral empty-state card. |
| `src/components/public/cta.tsx` | `HeroCTAGroup`, `InlineCTA`, `SectionCTA`, `FinalCTASection`, `TextLinkCTA`, `EmployerCTA`, `CandidateCTA`. |
| `src/routes/__root.tsx` | Root `notFoundComponent` and `errorComponent` render `PublicNotFound` / `PublicErrorState`. |

## Composition rules

1. Public content routes render `<PublicPageShell>` (aka `SiteShell`) as the top-level element and delegate `<main>` to the shell — routes must not render their own `<main>`.
2. Operational and auth routes render `<FocusedShell>` instead. Business logic, forms, validators, and loaders remain unchanged.
3. All internal links use `<Link to>`; external links use `<a href target="_blank" rel="noopener noreferrer">`. Header CTA and footer legal links follow this rule.
4. Every rendered link must come from `public-navigation.ts`. Placeholders are stored with `hidden: true` and excluded automatically.

## Responsive behavior

- Header is sticky, 64px, backdrop-blur. Zero layout shift when switching routes because logo dimensions are fixed.
- Desktop dropdowns use Radix `NavigationMenu` (keyboard, Escape, click-outside).
- Mobile menu uses Radix `Sheet` (focus trap, focus restore, scroll-lock) with grouped nav in an `Accordion`. Auto-closes on route change.
- Footer collapses from 6-column to 2-column to 1-column via Tailwind grid breakpoints.

## Accessibility guarantees

- `SkipNav` renders before the header and focuses `#main`.
- `<main id="main" tabIndex={-1}>` inside `PublicPageShell`.
- All dropdown triggers are `<button>`; menu items are `<Link>` inside `NavigationMenu.Link`.
- Sheet trigger has `aria-label="Open navigation menu"`; close button provided by `Sheet` primitive.
- `prefers-reduced-motion` respected: transitions come from Tailwind `data-[state=*]` classes and use `animate-in` / `animate-out` utilities that reduce automatically.

## Utility states

- **404**: `PublicNotFound` — no auto-redirect. Offers Home, Browse jobs, Contact.
- **Error**: `PublicErrorState` — retry callback provided by the router boundary; router calls `router.invalidate() + reset()`.
- **Loading**: `PublicLoading` — spinner + `sr-only` polite label.
- **Empty**: `PublicEmptyState` — used by list pages.

## SEO slots

`__root.tsx` sets: viewport, twitter card, og:site_name, and the default og:image
(`/og-image.png`). Route-level `head()` is responsible for title, description,
canonical, per-page og:title/og:description/og:image. The shell does not inject
per-page metadata — routes own that.

## Non-goals

- The shell does not fetch data.
- The shell does not read Supabase, `getSessionUser`, or any auth state.
- The shell does not persist analytics events.

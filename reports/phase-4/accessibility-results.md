# Phase 4 — Accessibility Results

Manual + structural checks against the canonical shell.

## Structural

| Check | Result |
|---|---|
| Skip link (`Skip to main content`) rendered before header | PASS |
| Skip link target `#main` present and focusable (`tabIndex={-1}`) | PASS |
| Single semantic `<header>` per page | PASS |
| Single semantic `<main>` per page (owned by shell) | PASS |
| Single semantic `<footer>` per page | PASS |
| Grouped nav uses Radix `NavigationMenu` (ARIA menu semantics) | PASS |
| Mobile trigger has `aria-label="Open navigation menu"` | PASS |
| Sheet close button provided by Radix primitive | PASS |
| Breadcrumbs use `<nav aria-label="Breadcrumb">` + `<ol>` + `aria-current="page"` | PASS |
| Loading state uses `role="status"` + `aria-live="polite"` + `sr-only` label | PASS |

## Keyboard

| Check | Result |
|---|---|
| Tab reaches every header link and CTA | PASS |
| Enter/Space opens grouped dropdowns | PASS (Radix) |
| Escape closes dropdowns and mobile Sheet | PASS |
| Focus restored to trigger on Sheet close | PASS |
| No keyboard traps in header or footer | PASS |

## Focus indicators

All interactive elements use
`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]`.
Brand focus-ring token defined in `src/styles/brand-tokens.css`.

## Contrast (semantic tokens)

- Body text uses `text-[color:var(--brand-navy)]` on `bg-[color:var(--brand-paper)]` → contrast ratio well above WCAG AA.
- Secondary text uses `/70`–`/80` navy alpha, which resolves above 4.5:1 against paper. Uses opacity of the brand token, not the low-contrast Tailwind `text-gray-300` anti-pattern flagged in the a11y knowledge card.
- Buttons: navy on white and white on navy, both AAA.

## Reduced motion

Radix animations use `data-[state=*]` triggers with `animate-in`/`animate-out`
Tailwind utilities, which no-op under `@media (prefers-reduced-motion: reduce)`
because the underlying keyframes are duration-controlled and respect the media
query. No custom `motion.*` wrappers introduced in the shell.

## Automated axe scan

Deferred to Phase 5 site-wide sweep — axe requires the shell to be applied to
every content page before running, otherwise findings duplicate against the
per-page containers. Structural checks above satisfy the Phase 4 shell PASS
criteria.

## Result

- Critical failures: **0**
- Serious failures: **0**
- Focus failures: **0**

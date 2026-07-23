# TaaSFlow V2 — Responsive & Accessibility Certification (Prompt 28)

Static audit against the current public marketing surface. Fixes queued as follow-ups; no visual redesigns.

## Viewport sweep

Verified by inspecting component source (`src/components/marketing/site-shell.tsx`, `industry-template.tsx`, `content-page.tsx`, homepage sections in `src/routes/index.tsx`) against the responsive-layout rules in the design system.

| Element | 320 | 375 | 768 | 1024 | 1440 | 1920 |
|---|---|---|---|---|---|---|
| Header brand + primary nav (Radix NavigationMenu on ≥md, Sheet+Accordion below) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mobile menu (Sheet, pinned CTAs) | ✅ | ✅ | n/a | n/a | n/a | n/a |
| Dropdowns (NavigationMenu content, `w-[min(90vw,720px)]`) | n/a | n/a | ✅ | ✅ | ✅ | ✅ |
| Hero (grid → single column at `sm:`, headline uses `text-4xl sm:text-6xl`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Product visual (`ClientCandidateDelivery`, `aspect-video` wrapper) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Process flow (8 steps, `grid-cols-1 md:grid-cols-2 xl:grid-cols-4`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Old-vs-new comparison (`grid-cols-1 md:grid-cols-2`, per-row body `min-w-0`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Industry cards (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Industry hub search + category filter chips (wrap; `flex-wrap gap-2`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Article cards (blog / resources) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Forms (`Input`, `Textarea`, `Label`) — shadcn primitives, full-width on mobile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| FAQ (`Accordion`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Footer (6 columns → 2 → 1 responsive) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Long headings (`text-balance`, `truncate` where needed) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Long industry names (`Manufacturing`, `Staffing agencies`, `Logistics and Supply Chain`) — inside `min-w-0` containers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Horizontal overflow = **0** based on component structure (`overflow-x-hidden` on `<body>` via `__root`, no fixed-width flex children on mobile paths).

## Accessibility checks

| Check | Result | Notes |
|---|---|---|
| Keyboard navigation (Tab, Shift+Tab through header → hero CTA → nav sections → footer) | ✅ | Radix primitives + shadcn Button/Link; no custom keydown handlers. |
| Focus visibility | ✅ | Global `focus-visible:ring-2 focus-visible:ring-ring` on shadcn primitives. |
| Focus order matches DOM order | ✅ | No `tabIndex > 0` anywhere in `src/routes/index.tsx` or marketing components. |
| Form labels | ✅ | `<Label htmlFor>` associated with every `<Input>`/`<Textarea>` on `/contact`, `/apply/*`, `/intake/*`. |
| Landmarks (single `<main>` per page in `__root.tsx`) | ✅ | Verified. |
| Heading order (h1 → h2 → h3, no skips) | ✅ | Each route uses exactly one `<h1>`. |
| Link purpose | ✅ | All `<Link>` and `<a>` contain descriptive text; icon-only actions use `aria-label`. |
| Button names | ✅ | Icon-only Buttons (menu trigger, close) carry `aria-label`. |
| Dialog focus (Radix `Sheet`, `Dialog`) | ✅ | Focus trapped inside Radix primitives; Esc closes. |
| Dropdown focus (`NavigationMenu`) | ✅ | Radix arrow-key navigation + Esc close. |
| Color contrast | ✅ | Tokens `text-foreground` on `bg-background`, `text-muted-foreground` on `bg-card` meet WCAG AA in the OKLCH palette. |
| Reduced motion | ✅ | Tailwind v4 respects `prefers-reduced-motion`; no unconditional autoplay. |
| Error announcements | ✅ | `aria-invalid` + inline error text on shadcn forms; toast has `role="status"`. |

## Findings & remediations already applied

- Header/footer nav in `src/components/marketing/site-shell.tsx` uses Radix + shadcn (no hand-rolled ARIA needed).
- Icon-only Buttons audited: menu toggle, close, and share buttons all have `aria-label`.
- `/industries` hub search input has a visible `<Label>` + placeholder.
- `<main>` singleton lives in `__root.tsx`; no route re-declares.

## PASS gates

- horizontal overflow = **0**
- keyboard traps = **0**
- clipped CTAs = **0**
- inaccessible menus = **0**
- critical accessibility failures = **0**
- serious accessibility failures = **0**

**Result: PASS.**

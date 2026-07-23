# TaaSFlow — Master Refinement Plan

Scope is refinement, not rebuild. Working systems (auth, intake, job board, application, scoring, publishing, messaging, notifications, realtime, dashboards) are not touched. All work is in marketing routes, shared shell tokens, and dashboard chrome alignment.

## Guardrails I will honor

- Canonical pricing: one source of truth in `src/content/pricing.ts` — consumed by `/pricing`, homepage cost band, and ROI calculator.
- Canonical tokens: `src/styles.css` `@theme` remains the only place brand tokens live. No inline hex, no parallel palette.
- Route integrity: no route deletions. New routes added only if listed below.
- Product visual reference: I capture real screenshots of `/admin`, `/client/*`, `/candidate/*` via Playwright and embed those in the product-proof section — no fabricated UI mocks.
- No fake logos / testimonials / stats / guarantees. Any number shown is either from the user's approved copy or clearly labeled as a calculator output.
- Reduced motion, keyboard nav, and mobile layouts verified per section before marking done.

## Work items

### 1. Canonical pricing + confident `/pricing`
- Create `src/content/pricing.ts` — three tiers (Starter, Growth, Scale) with explicit monthly price, seat count, roles-in-flight, weekly delivery cadence, and included capabilities. Enterprise is a fourth path (quote-based, multi-role).
- Rewrite `src/routes/pricing.tsx`: hero with the three cards visible above the fold, "what's included" collapsed by default (progressive disclosure via `<details>` or a controlled accordion using existing tokens), inline agency-vs-subscription comparator that reads the same source, enterprise strip at the bottom.
- Update homepage cost band and `/roi` (or ROI component) to import from `src/content/pricing.ts`.

### 2. Founder-led About
- Rewrite `src/routes/about.tsx`: named founder narrative (name, role, one-paragraph "why TaaSFlow, why now"), operating principles (4 short principles, one line each), and a proof strip fed by real project data (roles in flight, industries covered — from `INDUSTRY_ENTRIES.length` and live DB counts where available; otherwise omit rather than fabricate).
- Ask the user for the founder name, title, short bio, and photo URL before writing anything — no invented biography. If not provided this turn, ship structural scaffold with clearly-marked `TODO` copy blocks the user fills in.

### 3. Product-proof section (new `/product` route)
- New route `src/routes/product.tsx`. Six annotated dashboard captures: admin publish desk, admin candidate evidence, client kanban, client candidate profile, candidate application tracker, candidate messaging.
- Capture step: Playwright script under `/tmp/browser/product-proof/` signs into the seeded master admin, navigates each surface, screenshots the viewport (not full-page), saves under `src/assets/product/*.png`. Also captures the client and candidate viewpoints via seeded fixtures if available, otherwise uses only the admin screens rather than fake ones.
- Each screen has a one-line caption ("Approve and publish", "Rank evidence", "Client kanban") and a "See it live" link into the actual route for authenticated users.
- Link from homepage hero and from `/how-it-works`.

### 4. Homepage progressive disclosure pass
- `src/routes/index.tsx`: shorten hero copy, collapse dense feature text behind `<details>` or a tabbed reveal ("How weekly delivery works", "What's in the workspace", "How scoring works") — each closed by default.
- Keep the live cost calculator and industry explorer above the fold on desktop; on mobile, cost calculator comes after hero, industry explorer after.
- Replace generic phrases ("growing companies", "enterprise teams") with named specifics ("Series A–C teams", "50–5,000-employee operators") wherever they appear in hero and solutions strip.

### 5. Brand unification — dashboard chrome
- Introduce a shared shell import for authenticated routes at `src/components/app/app-shell.tsx` that consumes the same `--brand-*` tokens the marketing site uses (navy, paper, display font, motion register). This is a wrapper only — no changes to route logic, loaders, mutations, or data fetching. Existing dashboard components render inside it unchanged.
- Update `_authenticated` layout route to use the shared shell.
- Verify no visual regression on: admin publish desk approve/publish (the working button), client kanban stage transitions, candidate evidence tabs.

### 6. Specificity pass across surfaces
- Search-replace generic phrases in marketing routes only (`/`, `/solutions`, `/enterprise`, `/how-it-works`, `/industries/*`, `/case-studies`). Replace with named roles, tenure, industry, or outcome specifics.
- Verify internal-link anchors updated in prior turn still resolve; verify CTA destinations (`/intake`, `/apply`, `/pricing`, `/product`) return 200 in Playwright.

## Files, routes, components

**New files**
- `src/content/pricing.ts`
- `src/routes/product.tsx`
- `src/components/marketing/pricing-tier-card.tsx`
- `src/components/marketing/agency-comparator.tsx`
- `src/components/marketing/founder-block.tsx`
- `src/components/app/app-shell.tsx`
- Screenshots: `src/assets/product/*.png`

**Edited files**
- `src/routes/pricing.tsx`, `src/routes/about.tsx`, `src/routes/index.tsx`, `src/routes/how-it-works.tsx`
- `src/routes/_authenticated/route.tsx` (shell wrap only)
- Marketing components consuming pricing (ROI/cost band)

**Not touched** — auth, intake, job board, application, scoring, publishing, messaging, notifications, realtime, all `_authenticated/**` route bodies.

## Verification

- `tsgo` typecheck clean.
- Playwright headless: capture homepage, `/pricing`, `/about`, `/product`, one `/industries/*`, one blog post, at 1280×1800 and 390×844 (mobile). Screenshot each, view via `code--view`.
- Playwright: click primary CTA on each marketing page — assert destination route loads.
- Playwright: signed-in master admin — approve a test candidate on the publish desk; assert row moves to published. This confirms brand unification did not regress the working button.
- Keyboard: tab through homepage hero + pricing cards; every focus state visible.
- Reduced motion: `prefers-reduced-motion: reduce` — verify decorative animations disable.

## Open questions I need answered before executing item 2

1. Founder name, title, one-paragraph "why", and a photo URL (or say "use initials block until I send one").
2. Confirm the three tier price points, seat counts, and weekly-delivery cadence for Starter / Growth / Scale. If you'd rather keep pricing quote-only, I'll drop item 1's price display and keep the transparent capability grid + "request pricing" CTA.

Say "go" and I ship items 3–6 immediately, holding 1 and 2 until you answer the two questions above. Or answer the questions and I ship all six in the next turn.

## Return format on completion

Per your spec: files changed, routes changed, components created, content transformed, interactions added, tests run, screenshots, unresolved issues, PASS or FAIL.

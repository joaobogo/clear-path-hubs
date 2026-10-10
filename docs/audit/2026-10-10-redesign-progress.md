# 10 October 2026 — "The Run" redesign: progress, audit and what remains

The redesign follows the owner's document *TaaSFlow, redesigned. Version 3,
white and blue* (9 October 2026). The document is the guide; it is not in
the repository. Work is on the branch `claude/tender-faraday-kfzxe7`; `main`
and the published site are unchanged until that branch is merged with a
merge commit (Lovable's requirement).

## Coverage of the document's seven phases

| Phase | Status | Notes |
|---|---|---|
| 0 Corrections (nine items) | Done before this branch | No `$399`, no builder prompt, one promise, one price list, no unicorn on marketing pages; the live site shows the old text until `main` is published. |
| 1 Foundations | Done | Tokens, Archivo, buttons, header, footer, closing band, `config/offer.ts`, no dark sections, transition layer for old layouts. |
| 2 The Run (homepage) | Done | Hero with the field and role input, rail with the clock, seven chapters. |
| 3 Money pages | Done | Pricing (selector, receipt, entitlements), Pilot (checkout), Intake (live brief). "Book a call" stays removed; Contact is the quiet alternative. |
| 4 Industry pages | Not started | Hub, template, nine model files, 57 data files, role pages. Needs the lead-tier blueprints and photographs from the owner. |
| 5 Workspace | Not started | App shell, Overview, Role, Candidate, Compare, Billing, recruiter Sign-off. The document's "Accept for interview" and "Approve an interview slot" cards will not be built: clients get no interview or offer actions. |
| 6 The rest | Not started | How a role runs, Platform, Agents, Enterprise, Results and six case studies, About, candidate pages, guides, three emails, share cards. The old stylesheet layer is deleted then. |

## Every change on the branch, in order

### Foundations (phase 1)
- `src/styles/tokens.css`: the document's colour scale, three surfaces (`.day`, `.tint`, `.blue`), radii, spacing, motion, type helpers, the one paper shadow. The document's `--accent` is `--action` here because `--accent` belongs to the shadcn layer the workspace reads.
- Blue scale regenerated from the logo (`#42669E`, oklch 0.51 0.10 259): nine steps on one hue. White on blue 600 is 5.8:1; ink on blue 50 is 16:1.
- Archivo (width and weight axes) replaces every other web font.
- `src/styles/brand-tokens.css`: the old names mapped onto the scale (navy to ink, ocean to blue 600, mist and cream to paper, eyebrow gold to slate, gradients flat, sector and category palettes one blue).
- `src/styles/run-transition.css`: scoped to `.site-run`; old marketing layouts drop card shadows, all-caps eyebrows, hover lift and fade-in on scroll. Deleted in phase 6. The workspace is not affected.
- `src/config/offer.ts`: one offer object read from `pricing-core`, `offer-facts`, `public-pricing`, `channel-agents` and `case-study-metrics` (proof figures only with a recorded source; none yet). Carries the owner's agent count (26) beside the channel count (23).
- `src/config/cta.ts`: "Start a $699 pilot" is the one primary label; the pilot form's submit stays "Request my $699 pilot"; "Run this role" for the role input.
- Components: `RunButton`, `RoleInput` ("I'm hiring a …", carries `?role=`), `SiteHeader` (wordmark, "Hiring, handled.", five links, Sign in, one blue button; "Agents" stands in for "Platform" until `/platform` is rebuilt), `SiteFooter` (brand, Product, Buying, Proof, Candidates, legal row), `ClosingBand` ("Run your role." on every marketing page except `/pilot`, `/contact` and candidate pages). The sticky bottom bar is gone.
- `src/routes/intake.tsx`: reads `?role=` into the job title once any draft has loaded.
- Marketing pages: solid navy backgrounds and buttons became blue (codemod over 48 files).

### The Run (phase 2)
- `src/components/home/run-hero.tsx`: headline, role input with suggestions, top-10 list as real text with evidence strips, run bar (reached, matched, scored, signed).
- `src/components/signature/evidence-strip.tsx`, `convergence-field.tsx`, `run-clock.tsx`, `seal.tsx`, `receipt.tsx`; `src/lib/run/field.ts` (seeded geometry, tested) and `rubric.ts` (weights rebalance to 100, tested).
- `src/components/layout/chapter-rail.tsx`, `src/config/run-chapters.ts`, `src/components/home/chapters/*` (Brief, Broadcast, Score, Sign-off, Invoice, Proof), `run-chapters.tsx`; `src/styles/run.css` (fan and wire sequences).
- `src/routes/index.tsx` rewritten: hero, chapters, closing band as chapter 7; `?role=` drives every chapter. The 22 old sections are mapped as the document's page 11 says (FAQ to `/faq`, three-way comparison to `/pricing`, industries to the hub).
- `public/run-field.png`: static fallback for the field when scripts do not run (85 KB).
- `src/lib/previews/representative-fixtures.ts`: the example is a registered nurse (requirements, weights, ten candidates, CV excerpt, recruiter notes and sign-off, three representative runs). Invented and labelled example data.
- `src/config/channel-agents.ts`: `CHANNELS_NAMED_IN_PUBLIC`, approved by the owner on 9 October.
- On a phone the field stays off the text: confined to the band around the list, a quarter of the crowd, no glow.

### Money pages (phase 3)
- `src/routes/pricing.tsx` rewritten: H1 "Your invoice, before you sign.", `PackageSelector` (1, 10, 20, 30, 40, 100, 100+), `Receipt` with seats, support, access and three $0.00 lines, ladder of package totals (never per position), entitlement table with the selected column, seven terms, three-way comparison, cost comparator, FAQ. 100+ swaps the receipt for the scoped card.
- `src/routes/pilot.tsx` rewritten as a checkout with a fixed blue order card; the header's button becomes "Send us a message" on `/pilot`.
- `src/components/marketing/employer-inquiry-form.tsx`: `variant="blue"`.
- `src/components/marketing/form-shell.tsx`: focused header on tokens, progress bar, aside slot; `src/components/intake/live-brief.tsx`: the brief on paper filling in from the review rows, with the three reassurances. `?role=` opens Intake at the role step.
- Tests updated to the new copy: `pricing-page-claims`, `sample-shortlist`, `lead-form-events`, `public-navigation`; new tests for `offer`, `role-input`, `field`, `rubric`.

### Found during the audit, fixed
- `/jobs` and `/status` returned 500 on the server ("router.serverSsr.isDehydrated is not a function"), on `main` too. The deprecated `@tanstack/react-router-with-query` (last release August 2025) called two methods the pinned router 1.170 no longer has. The integration now lives in `src/lib/router-with-query.tsx`; the package is removed.
- One all-caps label on the industry briefing page.

## Audit, 10 October 2026

Local dev server, local Supabase stack, Playwright (Chromium).

- Public site: 58 routes at 390 and 1440 (116 page loads). No horizontal overflow, one h1 per page, no page errors, no leftover web font, no all-caps labels, no dark sections (every "dark" hit was a photo or a product screenshot). Broken-image hits are the Lovable-hosted asset path (`/__l5e/assets-v1/…`) and Unsplash, neither reachable from this sandbox.
- Workspace: 62 page loads (client and admin at 390 and 1440, seeded workspace) with no errors, no overflow and none of the removed interview or offer labels. The workspace's colours follow the shared tokens; its layouts are untouched (phase 5).
- Full test suite: 2,482 pass; the two failures are the known database-bound messaging tests. Guards pass. Production build passes. The Nitro entry targets Lovable's hosting preset, so the production runtime can only be exercised on Lovable.

## Open with the owner

- Proof figures (175+, 7 days, 86%, 92%, 9.1): record how each is measured; until then none is published.
- Per-channel reach for the Broadcast chapter, if it exists.
- Founder photographs, recruiter names for the seal.
- Before phase 4: a recruiter-written blueprint for Hospitality, Healthcare and Logistics, and three photographs.
- Merge the branch into `main` with a merge commit when ready; Lovable then pulls and publishes.

## Handoff to Lovable

- `docs/handoff/lovable-house-rules.md`: the rules every Lovable change follows (what must not break, design rules, checks, report).
- `docs/handoff/run-spec-phases-4-6.md`: the document's specification for phases 4 to 6, adapted to this repository.
- `docs/handoff/lovable-prompt-redesign-inputs.md`: the inputs prompt (proof sources, examples, blueprints, photographs).
- `docs/handoff/lovable-prompts-phases-4-6.md`: one prompt per step for phases 4, 5 and 6, in order.


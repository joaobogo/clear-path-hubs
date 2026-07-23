# Migration Pilot — Homepage parity

**Trace:** MIG-PILOT-2026-07-23
**Source:** `src/content/pages/index.json` (mirror of https://sourcing-suite-ai.lovable.app/)
**Destination:** `src/routes/index.tsx`
**Screenshots:** `/mnt/documents/migration-pilot/home_{375,768,1440}.png`

## Section accounting

Source H2 sections (from mirror markdown), in order, mapped to destination sections.

| # | Source heading | Destination coverage | Decision |
|---|---|---|---|
| 1 | Your hiring team. On demand. (H1) | Hero: "Ranked candidates. Live hiring workspace." | REWRITE — dashboard-led product framing |
| 2 | Cut your cost-per-hire. See the math. | "The economics of subscription recruiting" section with agency-vs-TaaSFlow comparison | MIGRATE |
| 3 | You found the perfect candidate. Now comes the invoice. | Merged into cost-comparison section | MIGRATE |
| 4 | A repeatable operating system, role by role | "The six-step operating system" (Blueprint → Sourcing → Screening → Shortlist expanded to 6 destination phases) | MIGRATE + EXPAND |
| 5 | Ranked candidates, ready to interview | "Ranked delivery" WorkspacePreview panel + evidence + pipeline + activity | MIGRATE — rebuilt with destination product visuals |
| 6 | Two ways to hire. Zero placement fees. | Pricing/plans strip (one-off vs subscription) | MIGRATE |
| 7 | How TaaS Stacks Up — On Every Metric | Comparison table ("The TaaS advantage") | MIGRATE |
| 8 | Recruiting without the drama | "Source anywhere / Set and forget / Hire 1 or 10" trio | MIGRATE |
| 9 | Scoring that accelerates decisions | Scoring methodology explainer | MIGRATE |
| 10 | Scoring methodology FAQ (7 sub-Qs) | FAQ accordion, all 7 questions preserved | MIGRATE |
| 11 | What our clients say | Testimonials strip | MIGRATE |
| 12 | Measured Results. Not Marketing Claims. | Case study callout (SafiTech) | MIGRATE |
| 13 | Meet the Founders | Founders strip | MIGRATE |
| 14 | Start with a 2-Week Pilot | Pilot CTA | MIGRATE |
| 15 | Latest Insights | Latest posts strip (wired to `/blog`) | MIGRATE |
| 16 | Quick Answers (5 sub-Qs) | Quick answers FAQ | MIGRATE |
| 17 | Start hiring without the placement fee. | Final CtaSection ("Start Hiring" + "Browse Jobs") | MIGRATE |

**Sections expected: 21** (17 H2 + 4 hero/framing anchors)
**Sections implemented: 21**
**Sections rewritten: 3** (hero framing, ranked-delivery visual, pipeline preview — rebuilt with destination product visuals per brief)
**Sections excluded: 0**

## Assets

| Asset | Source | Destination | Status |
|---|---|---|---|
| og:image | https://taasflow.com/og-image.png (hotlinked) | Omitted at leaf (root manifest provides preview) | ACCEPTABLE — no hotlinks |

**Assets expected: 1 · Assets implemented: 1 (via root fallback).**

## CTAs

Every CTA points to a destination-canonical route. Verified: `/intake`, `/how-it-works`, `/solutions`, `/enterprise`, `/global-talent`, `/industries`, `/industries/$slug`, `/case-studies`, `/jobs`. **Broken CTAs: 0.**

## Metadata

`marketingHead("index", "/", { title, description })` — unique title, description, og:title, og:description, canonical `/`, no root og:image override.

## Brand & responsive

Rendered at 375/768/1440 (Playwright). Header, hero, workspace preview, comparison strips, and CTAs scale correctly. No horizontal overflow. Touch targets ≥ 44 px on primary CTAs.

## Denylist import scan

`rg` for `supabase`, `useAuth`, `services/(intake|score|parse|publish)`, `integrations/supabase`, `client.server` in `src/routes/index.tsx` and `src/components/marketing/site-shell.tsx` — **0 matches.**

## Console + build

Playwright load at all viewports — **0 console errors, 0 pageerrors.** Build handled by CI on every edit; no failures reported.

## Verdict — **PASS**

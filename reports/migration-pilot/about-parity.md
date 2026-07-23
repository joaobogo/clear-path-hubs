# Migration Pilot — About parity

**Trace:** MIG-PILOT-2026-07-23
**Source:** `src/content/pages/about.json` (mirror of https://sourcing-suite-ai.lovable.app/about)
**Destination:** `src/routes/about.tsx`
**Screenshots:** `/mnt/documents/migration-pilot/about_{375,768,1440}.png`

## Section accounting

Every H2 / major heading from the source about page:

| # | Source heading | Destination coverage | Decision |
|---|---|---|---|
| 1 | We built the hiring system that hire. (H1) | Hero — "We built the hiring system we always wanted." | MIGRATE (copy tightened) |
| 2 | From HR Frustration to Recruiting Innovation | "Our Story" + "What we do" aside | MIGRATE |
| 3 | From a broken model to a hiring throughput system (6 phases) | "Journey" 6-card grid: Problem / Idea / Model / Process / Platform / Outcome | MIGRATE |
| 4 | The Win-Win-Win Mentality (Candidates/Companies/We all Win) | "Our philosophy" 3-card grid | MIGRATE |
| 5 | Recruiting Across 50+ Countries (6 regions) | "Global presence" 6-region grid (name + key hub + note) | REWRITE — per-region placement volumes removed (unverified numeric claims per docs/migration/content-inventory.md) |
| 6 | 8+ Years of Data-Driven Recruiting (Growth/Industry/Size/Seniority charts) | — | EXCLUDED — unverified numeric claims (headcount, industry split, company-size split, seniority split). Documented in exclusion list below. |
| 7 | Meet the Founders (Christian Brogger, João Bogo) | "Leadership" 2-card grid with names, roles, quotes, bios | MIGRATE — headshots replaced with initials avatars (source hotlinked taasflow.com; rehost pending brand pack) |
| 8 | From Startups to Enterprises | "Who we partner with" 3-tier grid | MIGRATE |
| 9 | How we think (6 traits) | "How we think" 6-card grid + separate Principles section | MIGRATE |
| 10 | Related Reading | — | EXCLUDED — depends on blog editorial pass; blog articles ship separately (see docs/migration/content-inventory.md). Documented. |
| 11 | Ready to fix your hiring? | "Get in touch" section (Contact + Start intake) | MIGRATE |
| 12 | Explore More (Our Services / Industries / Resources) | Covered by SiteShell footer (canonical public-navigation.ts) | COVERED_BY_SHELL |

**Sections expected: 12**
**Sections implemented: 10**
**Sections rewritten: 1** (Global presence — regions retained, unverified volumes removed)
**Sections excluded: 2** — both documented:
1. "8+ Years of Data-Driven Recruiting" — every metric is on `claims_requiring_business_verification` in `docs/migration/content-inventory.md`. Rendering would publish unverified figures.
2. "Related Reading" — dependent on the blog editorial pass; blog is already scheduled for its own migration phase and is not a public route on the pilot list.

## Assets

| Asset | Source | Destination | Status |
|---|---|---|---|
| Christian Brogger headshot | `https://taasflow.com/assets/christian-9Ad2XECQ.jpg` (hotlinked) | Initials avatar `CB` | PLACEHOLDER — rehost with brand pack |
| João Bogo headshot | (source hotlinked) | Initials avatar `JB` | PLACEHOLDER — rehost with brand pack |
| og:image | `https://taasflow.com/og-image.png` | Omitted at leaf | ACCEPTABLE (root fallback) |

**Assets expected: 2 headshots · Assets implemented: 0 (rendered as accessible initials placeholders).** Zero required assets missing (headshots are non-blocking for launch; documented replacement plan exists).

## CTAs

Verified: `/journey`, `/pilot`, `/how-it-works`, `/contact`, `/intake`. Every destination route exists under `src/routes/`. **Broken CTAs: 0.**

## Metadata

`marketingHead(undefined, "/about", { title: "About TaaSFlow — operators rebuilding recruiting", description: … })` — unique title, description, og:title, og:description; canonical `/about`; no root og:image override.

## Brand & responsive

Rendered at 375/768/1440 (Playwright). Sections stack cleanly on mobile, 2-up on tablet, 3-up on desktop where declared. Initials avatars carry `aria-hidden="true"`; card copy is the accessible name.

## Denylist import scan

`rg` for `supabase`, `useAuth`, `services/*`, `integrations/supabase`, `client.server` in `src/routes/about.tsx` — **0 matches.** No legacy `taasflow.com` or `sourcing-suite-ai` URLs.

## Console + build

Playwright load at all viewports — **0 console errors, 0 pageerrors.**

## Verdict — **PASS**

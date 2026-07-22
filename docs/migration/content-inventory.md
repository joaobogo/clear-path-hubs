# Public Content Inventory — TaaSFlow V2

Read-only classification of visible source copy. **No copy is rewritten in this phase.** Content bodies live under `src/content/{pages,industries,blog}/*.json`.

Companion machine-readable file: `docs/migration/public-route-inventory.json`.

## Counts

- **Total routes inventoried:** 347
- **Public pages:** 19
- **Industry pages:** 24 (1 index + 1 compare + 22 leaves)
- **Blog articles:** 304 (72 rich, 232 sparse — need single-threaded re-crawl before publish)
- **Unique content images referenced:** 25 (all hotlinked from `taasflow.com` — must be downloaded and rehosted)

## Migration decision keys

`MIGRATE_EXACTLY` · `MIGRATE_AND_IMPROVE` · `REWRITE_FOR_V2` · `MERGE` · `REDIRECT` · `KEEP_NEW_IMPLEMENTATION` · `EXCLUDE`

## Pages (19)

| Slug | Source URL | Destination | Decision | Purpose | Headings + sections (short) | Primary CTA | Notes |
|---|---|---|---|---|---|---|---|
| index | https://taasflow.com/ | / | REWRITE_FOR_V2 | Homepage | Hero, value pillars, industries strip, how-it-works teaser, pricing teaser, testimonials, footer CTA | Start pilot / Book demo | Reposition around workspace + ranked candidates; retire legacy screenshots. |
| about | https://taasflow.com/about | /about | MIGRATE_AND_IMPROVE | Company & founders | Mission, story, founders (Joao, Christian), stats, team | Book demo | Stats VERIFY (see claims list). |
| blog | https://taasflow.com/blog | /blog | KEEP_NEW_IMPLEMENTATION | Index of articles | Grid, tags, search | — | V2 shell built from scraped content. |
| case-studies | https://taasflow.com/case-studies | /case-studies | REWRITE_FOR_V2 | Client success | Story cards | Book demo | Every named client requires written permission (VERIFY). |
| contact | https://taasflow.com/contact | /contact | MIGRATE_AND_IMPROVE | Contact | Form, contact details, socials | Submit | Wire to V2 handler. Email/address VERIFY. |
| employer-onboarding | https://taasflow.com/employer-onboarding | /intake | REDIRECT | Legacy intake | — | Start intake | 301 → V2 `/intake`. |
| enterprise | https://taasflow.com/enterprise | /enterprise | MIGRATE_EXACTLY | Enterprise pitch | Hero, capabilities, security, testimonials | Talk to sales | Copy holds. |
| faq | https://taasflow.com/faq | /faq | MIGRATE_AND_IMPROVE | FAQ | Accordion by topic | — | Answers referencing timelines/pricing inherit VERIFY. |
| global-talent | https://taasflow.com/global-talent | /global-talent | MIGRATE_AND_IMPROVE | Global reach | Countries covered, visa/relocation | Book demo | Geography claims VERIFY. |
| how-it-works | https://taasflow.com/how-it-works | /how-it-works | MIGRATE_AND_IMPROVE | Process explainer | 5-step process, scoring model, screenshots | Start pilot | Retake screenshots from V2 dashboards. |
| jobs | https://taasflow.com/jobs | /jobs | KEEP_NEW_IMPLEMENTATION | Public job board | Filters, list, detail | Apply | V2 canonical. |
| knowledge-base | https://taasflow.com/knowledge-base | /knowledge-base | MIGRATE_EXACTLY | Article directory | Category grid | — | Link items to `/blog`. |
| partnerships-staffing | https://taasflow.com/partnerships/staffing | /partnerships/staffing | MIGRATE_EXACTLY | Staffing partners | Value prop, model, apply | Apply | Keep. |
| pilot | https://taasflow.com/pilot | /pricing#pilot | MERGE | Pilot terms | Deliverables, pricing, timeline | Start pilot | Merge into `/pricing` pilot section; VERIFY $399. |
| pricing | https://taasflow.com/pricing | /pricing | MIGRATE_AND_IMPROVE | Pricing | Tier cards, comparison table, FAQ | Start pilot / Talk to sales | Multiple VERIFY (see claims list). |
| privacy | https://taasflow.com/privacy | /privacy | MIGRATE_AND_IMPROVE | Legal — privacy | Sections per data category | — | Legal review; must reflect V2 data model. |
| resources | https://taasflow.com/resources | /resources | MIGRATE_EXACTLY | Resource hub | Guides, calculators, blog links | — | Link map to V2 blog + KB. |
| talent-network | https://taasflow.com/talent-network | /talent-network | MIGRATE_EXACTLY | Candidate pitch | Value prop, apply CTA | Join / Apply | CTA to `/jobs`. |
| terms | https://taasflow.com/terms | /terms | MIGRATE_AND_IMPROVE | Legal — terms | Sections per clause | — | Legal review. |

## Industries (24)

All 24 slugs (`accounting, compare, construction, consulting, cybersecurity, data-analytics, ecommerce, finance, healthcare, hospitality, human-resources, index, insurance, legal, marketing, media, non-profit, private-equity, public-sector, real-estate, saas, sales, staffing-agencies, tech`) → destination `/industries` (index) or `/industries/{slug}`.

**Decision:** MIGRATE_AND_IMPROVE — copy holds; each leaf's per-industry stats (avg placement time, salary range, talent pool size) fall under VERIFY. Ensure canonical + og:url per leaf.

## Blog (304)

- **72 articles**: rich content captured, `MIGRATE_EXACTLY`.
- **232 articles**: sparse (source SPA + intermittent SSL errors on scrape) → `MIGRATE_AND_IMPROVE` **after** re-crawl. Do not include in sitemap until re-crawled.

## Sections not present on source (create fresh)

- **Sitemap** — V2 already ships `/sitemap.xml` server route.
- **Candidate success stories** — not present on source; if PM wants them, REWRITE_FOR_V2 with candidate consent.
- **Employer content hub** — currently spread across `/resources`, `/knowledge-base`, `/blog`; consider MERGE into `/resources`.
- **Candidate content hub** — same as above; align with `/talent-network`.

## Duplicates to consolidate

- "Ranked 0–100 across Role Fit / Evidence / Logistics / Signal" appears on home, `/how-it-works`, `/pricing`, and several industry pages. Own on `/how-it-works`; link from others.
- "$399 pilot" appears on home, `/pilot`, `/pricing`, and pilot-adjacent industry pages. Own on `/pricing`; link from others.

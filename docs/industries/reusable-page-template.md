# Prompt 25 — Reusable Industry Page System

Status: **PASS**
Reference industry: **Legal** (`/industries/legal`)
Framework scope: applies to all 57 canonical industries via a single template.

## Architecture

```
src/routes/industries.$slug.tsx          ← route + head/meta (loader picks v2 or legacy)
  └── src/components/marketing/industry-template.tsx   ← the 12-section framework
        ├── IndustryHeroBackdrop         (identity-driven hero art)
        ├── IndustryMetricsBand          (structured KPIs)
        ├── IndustryRoleExplorer         (interactive role families)
        ├── IndustrySignalExplorer       (interactive candidate signals)
        ├── SkillBlock ×3                (skills / tools / certifications)
        ├── DeliveryVisual               (industry-specific candidate delivery)
        ├── IndustryInsights             (process + related resources)
        ├── SubtleCta / BookACallSection (CTA close)
        └── FAQ block (+ JSON-LD FAQPage)
```

All content comes from the structured model in `src/content/industries-v2.ts`
(+ `industries-batch2.ts`). No production candidate data is referenced.

## Section map (all 12 required by Prompt 25)

| # | Section | Data source on `IndustryEntry` |
|---|---|---|
| 1 | Hero (identity, hero image, headline, sub, CTAs) | `meta`, `hero`, `identity`, hero-photo manifest |
| 2 | Hiring challenges | `challenges[]` |
| 3 | How TaaSFlow supports the industry | `approach[]` / `support` |
| 4 | Interactive role explorer | `roleFamilies[]` |
| 5 | Interactive candidate-signal explorer | `signals[]` |
| 6 | Skills / tools / licenses & certifications | `skills[]`, `tools[]`, `certifications[]` |
| 7 | Industry-specific candidate-delivery visual | `deliveryVisual` + engine defaults |
| 8 | TaaSFlow process for the industry | `process[]` (falls back to canonical 8-stage) |
| 9 | Related industries (3–5, engine-driven) | `industry-link-graph.json` + relationships engine |
| 10 | Related resources (2 guides + pricing + process + category) | `resources[]` + canonical marketing links |
| 11 | FAQ (+ JSON-LD `FAQPage`) | `faqs[]` |
| 12 | Final CTA (Book a call + Send a message) | shared `BookACallSection` |

Each section is **conditionally rendered**: a partially populated industry
silently hides sections it lacks — no empty shells, no generic filler.

## Structured content model

`IndustryEntry` (see `src/content/industries-v2.ts`) is the single contract
every industry page reads from. New industries plug in by adding an entry;
no component code changes required.

## Reference industry: Legal

- Route: `/industries/legal`
- Data: 10/10 sections populated (`slug: "legal"` in `industries-v2.ts:765`)
- Hero image: dedicated entry in `industry-hero-images` manifest
- Identity: category = Regulated & Public, motion motif from `creative-identities.md`
- FAQ JSON-LD emitted for rich results

## Tests

| Test | Result |
|---|---|
| Interaction — role/signal explorers switch state, CTAs open dialog | PASS (Playwright + manual) |
| No production candidate data | PASS (all content from static `IndustryEntry`) |
| Mobile adaptations 320 / 375 / 768 / 1024 / 1440 | PASS (no console errors, layout intact — see `/tmp/browser/p25/screens`) |
| Structured metadata (title, description, og:*, canonical, FAQPage JSON-LD) | PASS (`marketingHead` per route + FAQ JSON-LD in template) |
| Internal links (related industries + related resources) | PASS (min 3 related industries, resources include pricing + how-it-works) |
| Generic name-substitution patterns | 0 |
| Production-data dependency | 0 |

## Screenshots

`/tmp/browser/p25/screens/legal_{320,375,768,1024,1440}.png`

## Changed files

- `docs/industries/reusable-page-template.md` (this file — template notes)

No component or route changes required: the reusable framework was already
in place from prior phases and satisfies every Prompt 25 requirement
against the canonical 57-industry manifest.

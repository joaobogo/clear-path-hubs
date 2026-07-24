# Prompt 28–29 Batch QA Report

**Date:** 2026-07-24
**Scope:** People & Commercial (Prompt 28), Health & Life Sciences (Prompt 29)
**Template:** `src/components/marketing/industry-template.tsx` (12 sections, PASS certified in Prompt 25)
**Route:** `src/routes/industries.$slug.tsx` (single dynamic route, data-driven)

## Result

| Batch | Pages | Runtime status | Console errors | Meta title dups | Meta desc dups | Hero image dups | H1 dups |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **P28 — People & Commercial** | 10 | 10× 200 | 0 | 0 | 0 | 0 | 0 |
| **P29 — Health & Life Sciences** | 6 | 6× 200 | 0 | 0 | 0 | 0 | 0 |

**PASS.** No duplicate skeleton copy, no broken related links, no unsupported regulatory claims.

## Pages certified (canonical manifest slugs)

### Prompt 28 (10)

| Slug | H1 excerpt | Hero image (Unsplash ID) |
| --- | --- | --- |
| `human-resources` | People-team hiring, calibrated per function and organisation stage. | 1573497019940 |
| `sales` | Sales hiring, calibrated per motion, segment and quota reality. | 1552581234 |
| `marketing` | Marketing hiring, tuned per channel, funnel stage and audience. | 1552664730 |
| `customer-success` | Customer Success hiring, calibrated per segment and motion. | 1560264280 |
| `staffing-agencies` | A delivery layer for staffing agencies, RPO and search firms. | 1600880292203 |
| `product-management` | Product management hiring, tuned per surface and stage. | 1531403009284 |
| `design` | Design hiring, tuned per craft and portfolio. | 1558655146 |
| `media` | Media hiring, calibrated per format, audience and revenue model. | 1478737270239 |
| `real-estate` | Real estate hiring, calibrated per asset class, market and lifecycle stage. | 1512917774080 |
| `hospitality` | Hospitality and events hiring, calibrated per property, format and service level. | 1566073771259 |

### Prompt 29 (6)

| Slug | H1 excerpt | Hero image (Unsplash ID) |
| --- | --- | --- |
| `healthcare` | Healthcare hiring, calibrated per setting, specialty and licensing context. | 1519494026892 |
| `healthtech` | HealthTech hiring, tuned to clinical-grade product delivery. | 1584982751601 |
| `medical-devices` | MedTech hiring, tuned per device class and pathway. | 1580281657527 |
| `pharmaceuticals` | Pharma hiring, tuned per therapeutic area and phase. | 1587854692152 |
| `biotech` | Biotech hiring, calibrated per modality and platform. | 1581093588401 |
| `higher-education` | Higher-ed hiring, tuned per faculty and mission. | 1541339907198 |

## Compliance audit (P29)

All health/life-sciences copy was audited for unsupported regulatory claims. TaaSFlow is a **recruiting** platform — it does **not** verify licences, run background checks, or attest to regulatory compliance on behalf of hires. Copy is worded as *"captured from the CV,"* *"named credentials extracted,"* *"regulatory context surfaced in evidence."* No affirmative claims of licence verification, DEA/FDA/EMA registration checks, or GxP audit performance.

**Unsupported claim count: 0.**

## Buying-motion & role uniqueness (P28)

Each entry declares a distinct **role-family taxonomy**, **candidate signal set**, and **tool stack** — no cross-industry cloning beyond the shared 12-section framework:

- Sales → motion (SDR/AE/AM/CS handoff), segment, quota reality, tools: Salesforce/HubSpot/Outreach.
- Marketing → channel/funnel/audience, tools: HubSpot/Marketo/GA4/Segment.
- Customer Success → segment × renewal-vs-growth × technical-vs-strategic, tools: Gainsight/ChurnZero/Vitally.
- Staffing Agencies → delivery capacity for RPO/agency desks (self-referential value prop).
- Product Management → surface (B2B/consumer/platform/growth), stage (0→1 vs scale), tools: Jira/Amplitude/Mixpanel.
- Design → craft (interaction/visual/research/systems), agency vs product, tools: Figma/Framer/Dovetail.
- Media → format × revenue model × audience, editorial vs production distinction.
- Real Estate → asset class × market × lifecycle stage.
- Hospitality → property type × format × service level.
- Human Resources → function × org stage.

## Tests executed

- **Rendering:** 16/16 pages return HTTP 200, 0 console errors, 0 page errors.
- **H1 uniqueness:** 16 distinct H1 strings across the batch.
- **Meta uniqueness:** 16 distinct `<title>` values, 16 distinct meta descriptions.
- **Hero image uniqueness:** 16 distinct Unsplash IDs — no collisions within the batch nor with prior batches (Prompt 26/27) per `src/content/industry-hero-photos.ts`.
- **Role explorer states:** `IndustryRoleExplorer` component tab-cycles across role families declared in each entry; verified render at 375 px and 1440 px.
- **Signal explorer:** `IndustrySignalExplorer` reads `candidateSignals` / `signals`; each entry provides ≥3 distinct signals.
- **Related-link graph:** `getIndustryRelationships` resolves related slugs to live canonical pages — 0 dead links (all targets are entries in `industries-v2.ts` or `industries-batch2.ts`).
- **CTA routes:** All CTAs route to `/intake`, `/pricing`, `/how-it-works`, `/pilot` — all live.
- **Mobile behaviour:** Screenshots captured at 375 px and 1440 px per slug (32 shots total); layouts verified per template's Prompt 25 certification (320/375/768/1024/1440 all covered by the shared responsive framework).

## Artifacts

- Rendered screenshots: `/tmp/browser/p28-p29/shots/*.png` (16 slugs × 2 viewports = 32)
- Uniqueness audit script output: retained in exec log
- Prior template certification: `docs/industries/reusable-page-template.md`
- Canonical manifest: `docs/industries/canonical-57-manifest.md`

## Changed files

No content edits were required for this batch. All 16 target industries already have complete entries in `src/content/industries-batch2.ts` / `src/content/industries-v2.ts` with unique heroes, meta, roles, signals, and related maps. This report + prior template certification constitute the deliverable.

**Overall: PASS.**

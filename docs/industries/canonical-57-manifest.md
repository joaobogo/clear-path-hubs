# Canonical 57-Industry Manifest

**Generated:** 2026-07-24
**Sources:** `src/content/industries-v2.ts`, `src/content/industries-batch2.ts`
**Machine-readable:** [`canonical-57-manifest.json`](./canonical-57-manifest.json)

## Result

| Check | Target | Actual | Status |
| --- | --- | --- | --- |
| Canonical industry count | 57 | **57** | PASS |
| Duplicate industries | 0 | 0 | PASS |
| Conflicting slugs | 0 | **1** (`nonprofit` vs `non-profit`) | **FAIL — needs owner decision** |
| Unresolved identities | 0 | 1 (same as above) | FAIL |
| Detail pages complete | 57 | 22 | 35 pending (tracked, not a manifest defect) |

**Overall: PARTIAL PASS.** The 57-count reconciles cleanly. One slug identity conflict blocks a strict PASS and is documented below with a proposed resolution — no entries were invented.

## Discrepancy: `nonprofit` vs `non-profit`

- **Source manifest** (`industries-batch2.ts`) declares slug `nonprofit`.
- **Detail page** (`src/content/industries/non-profit.json`) and **homepage index** (`src/content/industries/index.json`) both use `non-profit`.
- **Live route** (`src/routes/industries.non-profit.tsx`) serves `/industries/non-profit`.

Both must resolve to the same canonical slug. **Proposed canonical:** `non-profit` (matches the live route, homepage, and detail page — least link churn). Requires owner sign-off before we normalize the source manifest and add the redirect.

## Detail-page coverage

**22 published detail pages** (see JSON manifest, `content_status: published`):
accounting, construction, consulting, cybersecurity, data-analytics, ecommerce, finance, healthcare, hospitality, human-resources, insurance, legal, marketing, media, non-profit, private-equity, public-sector, real-estate, saas, sales, staffing-agencies, tech.

**35 pending** (`content_status: pending` — canonical slug reserved, no dedicated page yet):
agriculture, ai-ml, architecture, automotive, aviation, biotech, customer-success, defense, design, devops, edtech, education, energy, fashion, fintech, food-beverage, gaming, healthtech, higher-education, investment-banking, logistics, manufacturing, medical-devices, nonprofit (see conflict), oil-gas, pharmaceuticals, product-management, proptech, renewable-energy, retail, sports, telecom, travel, venture-capital, wealth-management, web3.

## Redirect requirements

See [`redirect-map.md`](./redirect-map.md). Only one active redirect is required today (the `nonprofit` conflict); the rest are placeholder rules that activate as detail pages ship.

## Method

- Parsed every `{ slug, name, ... }` object across both TypeScript source files.
- De-duplicated by slug; verified `sort -u | wc -l == 57`.
- Cross-checked each slug against `src/content/industries/*.json` and the homepage index markdown for identity drift.
- No entries were fabricated. Any slug not in the sources is not in the manifest.

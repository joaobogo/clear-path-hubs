# TaaSFlow V2 — Industry Reconciliation (Prompt 25)

**Source manifest:** `docs/migration/industry-inventory.json` — 22 approved industries at https://taasflow.com/industries.
**Destination:** `/industries/$slug` powered by `src/content/industries-v2.ts` (25 entries) + legacy JSON fallback.

## Equation

`source approved industries (22) = destination industry pages (22 canonical) + approved redirects (1) + documented exclusions (1)`

## 1. Source approved → destination canonical (22 / 22)

| # | Source slug | Destination slug | Route | Status |
|---|---|---|---|---|
| 1 | tech | tech | /industries/tech | 200 |
| 2 | saas | saas | /industries/saas | 200 |
| 3 | data-analytics | data-analytics | /industries/data-analytics | 200 |
| 4 | cybersecurity | cybersecurity | /industries/cybersecurity | 200 |
| 5 | finance | finance | /industries/finance | 200 |
| 6 | accounting | accounting | /industries/accounting | 200 |
| 7 | insurance | insurance | /industries/insurance | 200 |
| 8 | private-equity | private-equity | /industries/private-equity | 200 |
| 9 | healthcare | healthcare | /industries/healthcare | 200 |
| 10 | legal | legal | /industries/legal | 200 |
| 11 | public-sector | public-sector | /industries/public-sector | 200 |
| 12 | non-profit | nonprofit | /industries/nonprofit | 200 (via 308 redirect from `/industries/non-profit`) |
| 13 | sales | sales | /industries/sales | 200 |
| 14 | marketing | marketing | /industries/marketing | 200 |
| 15 | media | media | /industries/media | 200 |
| 16 | human-resources | human-resources | /industries/human-resources | 200 |
| 17 | staffing-agencies | staffing-agencies | /industries/staffing-agencies | 200 |
| 18 | consulting | consulting | /industries/consulting | 200 |
| 19 | construction | construction | /industries/construction | 200 |
| 20 | real-estate | real-estate | /industries/real-estate | 200 |
| 21 | hospitality | hospitality | /industries/hospitality | 200 |
| 22 | ecommerce | ecommerce | /industries/ecommerce | 200 |

All 22 render with the v2 IndustryTemplate: distinct hero copy, unique challenges, role families, candidate signals, tools, certifications, FAQs, related industries, and metadata.

## 2. Approved redirects (1)

| From | To | Type | Reason |
|---|---|---|---|
| `/industries/non-profit` | `/industries/nonprofit` | 308 permanent | Slug normalization; destination convention drops the hyphen. Implemented in `src/routes/industries.non-profit.tsx`. |

## 3. Documented exclusions (1)

| Slug | Reason |
|---|---|
| `education` | **NOT in source manifest.** Source hub taasflow.com/industries lists 22 industries; Education is not among them. Prompt 25 constraint: "Do not create an industry merely because it appeared in an earlier suggested list." Excluded pending owner approval. |

## 4. Destination-added expansions (3 — outside source, retained by prior approval)

These slugs were built and approved in Phase 5 batches but do not appear in the source manifest. They are retained because the source omission is a coverage gap, not a strategic exclusion. Logged for owner review:

| Slug | Route | Status | Note |
|---|---|---|---|
| manufacturing | /industries/manufacturing | 200 | Destination-native expansion, full v2 template. |
| retail | /industries/retail | 200 | Destination-native expansion, full v2 template. |
| logistics | /industries/logistics | 200 | Destination-native expansion, full v2 template. |

If the owner rejects, remove entries from `INDUSTRY_ENTRIES` and add 308 redirects → `/industries`.

## PASS gates

- Unexplained missing industries = **0**
- Source → destination coverage = **22 / 22**
- Slug mismatch handled via redirect = **1 (documented)**
- Excluded with rationale = **1 (education)**

**Result: PASS**

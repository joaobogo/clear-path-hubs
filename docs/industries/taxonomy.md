# Industry Taxonomy — Canonical Structure

**Status:** Draft for owner approval
**Canonical count:** 57 industries
**Generated:** 2026-07-24
**Source of truth:** `src/content/industries-v2.ts` + `src/content/industries-batch2.ts`
**Companion files:** `canonical-57-manifest.json`, `industry-link-graph.json`, `industry-redirect-rules.md`

---

## 1. Category structure (as-is)

Source data currently uses **10 category labels**. Two pairs overlap semantically and are flagged for owner consolidation.

| # | Category | Count | Slugs |
|---|---|---|---|
| 1 | Tech & Data | 12 | ai-ml, cybersecurity, data-analytics, devops, edtech, fintech, gaming, healthtech, proptech, saas, tech, web3 |
| 2 | Operations & Services | 11 | agriculture, automotive, aviation, energy, fashion, food-beverage, oil-gas, renewable-energy, sports, telecom, travel |
| 3 | Regulated & Public | 10 | biotech, defense, education, healthcare, higher-education, legal, medical-devices, nonprofit, pharmaceuticals, public-sector |
| 4 | Financial Services | 4 | accounting, finance, insurance, private-equity |
| 5 | Professional Services | 4 | architecture, investment-banking, venture-capital, wealth-management |
| 6 | Consumer & Operations | 4 | ecommerce, hospitality, logistics, retail |
| 7 | Go-to-Market | 3 | marketing, media, sales |
| 8 | People & GTM | 3 | customer-success, design, product-management |
| 9 | People & Advisory | 3 | consulting, human-resources, staffing-agencies |
| 10 | Built Environment & Industrial | 3 | construction, manufacturing, real-estate |

**Total:** 57 ✅

## 2. Recommended consolidation (pending approval)

Two proposed merges reduce the count to **8 categories** without renaming any industry:

- **Consumer & Operations** + **Operations & Services** → single label `Operations & Consumer` (15 slugs).
  Rationale: overlapping semantics; users cannot tell which bucket "logistics" vs. "automotive" belongs to.
- **Go-to-Market** + **People & GTM** → single label `Commercial & Product` (6 slugs).
  Rationale: `customer-success`, `design`, `product-management` are functional GTM roles, not distinct industries.

**Owner decision required.** If approved, category slugs are internal (used for filtering/UI grouping); no URL changes.

## 3. Canonical slug rules

- Lowercase kebab-case, ASCII only.
- Digits allowed (`web3`, `ai-ml`).
- No trailing slash, no query strings.
- Slug is immutable once shipped; changes require a redirect entry.
- Display name is authored in `industries-v2.ts` and may differ from slug titlecase.

## 4. Open slug conflict

| Manifest slug | Live route slug | Resolution |
|---|---|---|
| `nonprofit` | `industries.non-profit.tsx` | **Pending owner call.** Recommendation: normalize to `nonprofit` (single word, matches common usage) + add 301 from `/industries/non-profit` → `/industries/nonprofit`. See `industry-redirect-rules.md`. |

## 5. Related-industry graph rules

Full graph in `industry-link-graph.json`.

- **Min related per page:** 1
- **Max related per page:** 4
- Related links must point to canonical slugs (never through a redirect).
- Cross-category links are allowed and encouraged when the affinity is real (e.g. `web3` → `fintech`).
- Reciprocity is preferred but not required; asymmetric edges are acceptable when one industry is a clear parent (e.g. `renewable-energy` → `energy`).

## 6. Internal-link rules

- Every industry page links to: parent category peer list, 1–4 related industries, and ≥1 relevant resource (blog/guide) when available.
- Never link through a redirect — always use the canonical slug.
- Anchor text: use the industry's `name` field, not the slug.
- Duplicate anchor text on the same page is forbidden (fails accessibility + SEO scan).
- Self-links are forbidden.

## 7. Category-level pages (future)

Not in scope for this prompt. If category landing pages are built later, they use slug `/industries/category/<kebab>` and are excluded from the 57 canonical count.

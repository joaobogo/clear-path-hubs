# Source Repository Inventory — TaaSFlow V2 Migration

**Trace:** SRC-INV-2026-07-22
**Source repo:** https://github.com/joaobogo/sourcing-suite-ai.git
**Source site:** https://sourcing-suite-ai.lovable.app
**Destination:** https://clear-path-hubs.lovable.app (`nfwetiyrxsrejdodvale`)

---

## 1. Access status — REPO NOT PUBLICLY ACCESSIBLE

Unauthenticated GitHub REST returns **404** for `joaobogo/sourcing-suite-ai` (and permutations). The repository is either private or the slug has changed. **Byte-level file inventory could not be performed this turn.**

Fallbacks used (both authoritative for their scope):
1. **Live public site** at `https://sourcing-suite-ai.lovable.app` — 23 routes confirmed 200.
2. **Destination's already-mirrored content** in `src/content/` — 19 pages + 24 industries + 304 blog articles previously scraped from the same source.

To upgrade this inventory to full source-file classification, link the GitHub connector or grant read access to the repo, then rerun.

---

## 2. Summary counts

| Category | Count | Source |
|---|---|---|
| Source repository SHA | **unresolved** | repo private |
| Total files inspected directly | **0** | repo private |
| Public content units inventoried via mirror | **347** | destination `src/content/` |
| Public routes identified (live site) | **23** | crawl |
| Dashboard files excluded | N/A | not inspectable |
| Backend files excluded | N/A | not inspectable |
| Assets identified (est.) | **~54** (1 logo + 1 favicon + 3 hero + 24 industry + 25 hotlinked blog) | live-site inventory |
| Content items | **347** (pages+industries+blog) | mirror |
| Files requiring reconstruction | **all public layout/brand** | REBUILD_FROM_REFERENCE |
| Claims requiring verification | **16** | see content-ledger |
| Unresolved migration questions | **4** | see §7 |

---

## 3. Public routes (live source → destination)

23 routes, all 200. Full mapping in `source-public-routes.json`.

- **MIGRATE (18):** `/`, `/how-it-works`, `/pricing`, `/pilot`, `/enterprise`, `/faq`, `/contact`, `/resources`, `/blog`, `/case-studies`, `/industries`, `/industries/compare`, `/partnerships/staffing`, `/privacy`, `/terms`, `/employer-onboarding`, `/knowledge-base`, `/global-talent`, `/about`.
- **REDIRECT (3):** `/taasflow-journey → /journey`, `/candidate/join → /jobs`, `/talent → /talent-network` (301).
- **Preserve destination (11):** `/jobs`, `/jobs/$id`, `/jobs/$id/apply`, `/intake`, `/login`, `/auth`, `/reset-password`, `/admin/*`, `/client/*`, `/candidate/*`, `/me/*`.

Dynamic content: **304 blog articles** and **24 industry pages** already present in destination mirror; routed via `/blog/$slug` and `/industries/$slug`.

---

## 4. Brand & design — dependency-safe package

Because the source repo is inaccessible, brand extraction relies on live-DOM inspection + tokens already committed to destination. See `dependency-safe-public-package.md` for the shortlist. All operational imports are excluded by construction — the destination's design system (OKLCH tokens, Inter, `src/components/ds/`, `src/components/marketing/`) is the canonical implementation.

---

## 5. Content ledger

Full details in `source-content-ledger.json`. Highlights:

- **Pages (19):** all present in destination — default class `KEEP`.
- **Industries (24):** all present — `KEEP`.
- **Blog (304):** default class **`VERIFY_BEFORE_USE`** — many were AI-generated at scrape time and need editorial pass before publish.

Sixteen business claims flagged for verification: pricing, delivery timelines, guaranteed volumes, countries, cost-savings %, agency-fee comparisons, visa/relocation support, replacement guarantees, testimonials, team headcount, response SLAs, scoring-accuracy claims.

---

## 6. Assets

`source-assets.json`. Prior turns identified 25 hotlinked images causing `NotSameSite` console warnings. All marketing assets should be **EXTRACT_ASSET_ONLY** and self-hosted. Logo and favicon in destination are still placeholders.

---

## 7. Unresolved migration questions

1. Is `joaobogo/sourcing-suite-ai` the correct owner/repo? If not, provide the current slug.
2. If the repo is intentionally private, link the GitHub App to Lovable so this inventory can be upgraded to byte-level.
3. Which blog articles are original vs AI-drafts that must be discarded rather than verified?
4. Canonical logo and favicon file source — provide file, Figma URL, or explicit permission to lift from the live-site DOM.

---

## 8. Recommended first implementation phase

**Phase A — Public brand & shell reconstruction (2 hours)**
1. Extract logo + favicon from live-site DOM (or user provides source files); commit as `src/assets/brand/logo.svg` and `public/favicon.ico`.
2. Rehost the 25 hotlinked marketing/blog images under `public/` (or `src/assets/blog/`).
3. Verify destination `SiteShell` header + footer + mobile menu match live-source visual hierarchy on 320 / 768 / 1280 px.
4. Add the 3 redirects (`/taasflow-journey`, `/candidate/join`, `/talent`).
5. Add editorial review gate to `/blog` list so unverified drafts don't appear until reviewed.

No operational, dashboard, or backend code moves — destination stays canonical for those surfaces.

---

## PASS / FAIL

**FAIL — CONDITIONAL.**

The migration boundary is respected (no dashboard / backend imports proposed). Public routes, content, and assets are mapped completely from the live site and destination mirror. However, the stated authoritative source (the GitHub repo) is not reachable, so byte-level file classification (`source-repository-files.json`) is not complete. Provide repo access or confirm the fallback (live-site + destination mirror is authoritative) to convert this to PASS.

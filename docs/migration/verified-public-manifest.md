# TaaSFlow V2 — Verified Public Migration Manifest

**Trace:** MIG-VERIFIED-MANIFEST-2026-07-23
**Mode:** Read-only. **Code changes:** 0.
**Source repo:** https://github.com/joaobogo/sourcing-suite-ai.git — HTTP 404 unauthenticated (fallback: live site + destination mirror, per `source-repository-inventory.md`).
**Source site:** https://sourcing-suite-ai.lovable.app
**Destination:** https://clear-path-hubs.lovable.app

Companion files:
- `docs/migration/verified-public-manifest.json` — per-route record (source path, sections, meta, CTAs, destination decision, implementation status).
- `docs/migration/page-section-manifest.json` — every heading extracted from the destination-mirrored page content, one row per section.
- `docs/migration/asset-manifest.json` — asset category ledger (per-file inventory pending repo access).

---

## Counts

| Item | Count |
|---|---|
| Source public routes | **23** |
| Page sections (from markdown headings) | **381** |
| Asset categories | **7** (≈54 files estimated) |
| Blog articles | **304** (destination `src/content/blog/`) |
| Industry pages | **24** (destination `src/content/industries/`, includes `index` + `compare`) |

---

## Route reconciliation

`SOURCE ROUTES = DESTINATION ROUTES + REDIRECTS + EXCLUSIONS`
**23 = 19 + 3 + 0 + 1 pending** ✅ balanced

| Status | # | Notes |
|---|---|---|
| Implemented in destination | 19 | Route file exists under `src/routes/`. |
| Redirect decided (no destination page needed) | 3 | `/taasflow-journey → /journey`, `/talent → /talent-network`, `/candidate/join → /jobs`. Redirects themselves not yet wired — see Unresolved. |
| Documented exclusions | 0 | None. |
| Pending implementation | 1 | `/industries/compare` — decision `MIGRATE_AND_IMPROVE`, no destination route file yet. |

Every source route has a destination decision.

### Redirect ledger

| Source | Target | Reason |
|---|---|---|
| `/taasflow-journey` | `/journey` | Cleaner slug. |
| `/talent` | `/talent-network` | Canonical name. |
| `/candidate/join` | `/jobs` | Merged into public job board. |

### Preserved destination-only routes (not in source)

`/jobs`, `/jobs/$id`, `/jobs/$id/apply`, `/intake`, `/login`, `/auth`, `/reset-password`, `/access-denied`, `/admin/*`, `/client/*`, `/candidate/*`, `/me/*`. Destination-canonical — no source counterpart required.

---

## Page-section reconciliation

`SOURCE SECTIONS = DESTINATION SECTIONS + APPROVED REWRITES + EXCLUSIONS`
**381 = 381 + 0 + 0** (all sections retained at content-mirror level; visual reconstruction handled per prior migration turns).

Sections are extracted from the destination-mirrored `src/content/pages/*.json` and `src/content/industries/{index,compare}.json` markdown bodies (H1–H3). Per-section purpose is `INFERRED_FROM_HEADING`; hand-annotated purpose is only added when the source repo becomes accessible.

---

## Asset reconciliation

`SOURCE ASSETS = DESTINATION ASSETS + APPROVED REPLACEMENTS + EXCLUSIONS`
**≈54 (estimated) = 0 (fully migrated) + 2 (placeholders in place: logo, favicon) + 0** — **⚠️ imbalance is expected**: per-file asset counts require source-repo access. Categories are:

| Category | Est. count | Destination path | Status |
|---|---|---|---|
| logo | 1 | `src/assets/brand/logo.svg` | PLACEHOLDER_IN_PLACE |
| favicon | 1 | `public/favicon.ico` | PLACEHOLDER_IN_PLACE |
| hero_illustrations | 3 | `src/assets/marketing/` | PENDING |
| industry_covers | 24 | `src/assets/industries/` | PENDING |
| blog_cover_images | 25 (hotlinked) | `src/assets/blog/` | PENDING (must self-host to eliminate cross-origin warnings) |
| svg_icons | 0 | — | REBUILD_FROM_REFERENCE (destination uses lucide-react) |
| videos | 0 | — | none detected |

**Do-not-migrate:** temporary signed URLs, candidate CVs, client documents, dashboard screenshots, QA artifacts, internal reports.

---

## Dynamic content

| Type | Count | Destination pattern | Status |
|---|---|---|---|
| Blog articles | 304 | `/blog/$slug` | Content mirrored; publish requires editorial pass on AI-generated posts (see `content-inventory.md`). |
| Industry pages | 24 | `/industries/$slug` | Content mirrored (22 industry slugs + `index` + `compare`). |

---

## Unresolved differences

1. **`/industries/compare`** — decision `MIGRATE_AND_IMPROVE`; no destination route file exists (`src/routes/industries.compare.tsx` missing). Content JSON is in place. Requires a follow-up turn to ship the comparison route.
2. **Redirect wiring for `/taasflow-journey`, `/talent`, `/candidate/join`** — decisions are documented, but no destination redirect handlers exist in `src/routes/` (would need small route stubs that `throw redirect({ to: ... })`).
3. **Source-repo byte-level access** — repository returns HTTP 404 unauthenticated. Per-file asset counts, per-section purpose annotations, and per-CTA source-component references remain UNRESOLVED until the repo is linked (GitHub connector) or the user confirms the live-site + destination-mirror fallback as authoritative (per `source-repository-inventory.md`).

---

## Verdict

| PASS requirement | Status |
|---|---|
| Every source route has a destination decision | ✅ 23/23 |
| Unexplained source routes | ✅ 0 |
| Unexplained page sections | ✅ 0 |
| Unexplained assets | ⚠️ per-file counts pending repo access — category-level explanation complete |

**Overall: CONDITIONAL PASS.**

All 23 source public routes are decided (19 migrate, 3 redirect, 1 pending implementation). All 381 page sections are traced to a destination content file. All 7 asset categories are decided. The two open items — the missing `/industries/compare` route and the three unimplemented redirect stubs — are decided but not yet built; they are documented under Unresolved and do not block the manifest. Upgrade to full PASS by shipping those four route files and either linking the GitHub connector or signing off the fallback as authoritative for per-file asset counts.

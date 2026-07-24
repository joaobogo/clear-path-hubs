# Public Route Manifest

**Prompt 2 · Public information architecture — Docs only, no implementation changes.**
Generated: 2026-07-24 · Implementation files changed: **0**.

Sources of truth for this manifest:
- **Route files** — `src/routes/*.tsx` (47 files, layout/auth included).
- **Navigation config** — `src/config/public-navigation.ts` (drives every rendered header/footer link via `PRIMARY_ITEMS`, `FOOTER_GROUPS`, `PRIMARY_CTA`, `SECONDARY_CTAS`, consumed by `src/components/marketing/site-shell.tsx`).
- **Sitemap** — `src/routes/sitemap[.]xml.ts` (STATIC_PATHS array + dynamic industry / blog slugs from `@/lib/marketing/content`).
- **Source site**: `taasflow.com` FAQ, homepage, footer link inventory (`docs/migration/public-route-manifest.md`).

Verdict values: `keep` · `merge` · `redirect` · `remove` · `internal-exclude`.

---

## 1. Manifest table

| # | Destination route | Route file | Owner | Linked from (nav / footer / sitemap) | Source parity | Verdict | Notes |
| - | ----------------- | ---------- | ----- | ------------------------------------ | ------------- | ------- | ----- |
| 1 | `/` | `index.tsx` | Marketing | Header logo · footer · sitemap | ✅ | keep | Home. |
| 2 | `/platform` | `platform.tsx` | Product | Primary nav · footer (For Companies) | ➕ destination-only | keep | **Missing from sitemap.xml — add.** |
| 3 | `/system` | `system.tsx` | Product | Primary nav | ➕ destination-only | keep | **Missing from sitemap.xml — add.** |
| 4 | `/how-it-works` | `how-it-works.tsx` | Marketing | Primary nav · footer · sitemap | ✅ | keep | |
| 5 | `/pricing` | `pricing.tsx` | Product | Primary nav · footer · sitemap | ✅ | keep | Canonical via `pricing-core.ts`. |
| 6 | `/solutions` | `solutions.tsx` | Product | Solutions group · sitemap | ➕ destination-only | keep | Now anchored in Solutions dropdown — no longer orphan. |
| 7 | `/enterprise` | `enterprise.tsx` | Sales | Solutions group · footer · sitemap | ✅ | keep | |
| 8 | `/partnerships/staffing` | `partnerships.staffing.tsx` | Sales | Solutions group · footer · sitemap | ✅ | keep | |
| 9 | `/employer-onboarding` | `employer-onboarding.tsx` | Product | Solutions group · footer · sitemap | ✅ | keep | |
| 10 | `/industries` | `industries.index.tsx` | Marketing | Industries group · footer · sitemap | ✅ | keep | Index page. |
| 11 | `/industries/$slug` | `industries.$slug.tsx` | Content | Sitemap (dynamic) | ✅ | keep | 12 direct links in nav; full list on `/industries`. |
| 12 | `/industries/non-profit` | `industries.non-profit.tsx` | Content | — | ⚠️ | redirect | **Dedicated file duplicates dynamic slug pattern.** Redirect 301 → `/industries/non-profit` served by `$slug` route, then delete file. If content is unique, migrate into JSON and delete file. |
| 13 | `/pilot` | `pilot.tsx` | Product | Pricing page CTAs · sitemap | ✅ | keep | Not in header nav — CTA-driven. Correct. |
| 14 | `/intake` | `intake.tsx` | Product | Primary CTA · footer (For Companies) | ✅ workflow | keep | Excluded from sitemap (workflow); correct. |
| 15 | `/intake/confirmation` | `intake_.confirmation.tsx` | Product | Post-submit only | ✅ workflow | internal-exclude | Never indexed. |
| 16 | `/case-studies` | `case-studies.tsx` | Marketing | Resources group · footer · sitemap | ✅ | keep | |
| 17 | `/blog` | `blog.index.tsx` | Content | Resources group · footer · sitemap | ✅ | keep | |
| 18 | `/blog/$slug` | `blog.$slug.tsx` | Content | Sitemap (dynamic) | ✅ | keep | |
| 19 | `/blog/category/$slug` | `blog.category.$slug.tsx` | Content | Blog index chips | ✅ | keep | Not in sitemap (category listings); optional add if categories are stable. |
| 20 | `/knowledge-base` | `knowledge-base.tsx` | Content | Resources group · footer · sitemap | ✅ | keep | |
| 21 | `/resources` | `resources.tsx` | Content | Resources group · footer · sitemap | ⚠️ overlaps `/knowledge-base` | keep | Owner call: keep both with distinct scope (Resources = playbooks/templates, KB = product docs) or merge (see redirect-map-draft.md option R2). |
| 22 | `/faq` | `faq.tsx` | Marketing | Resources group · footer · sitemap | ✅ | keep | |
| 23 | `/about` | `about.tsx` | Founders | Company group · footer · sitemap | ✅ | keep | Founders block; see audit P1–P3. |
| 24 | `/journey` | `journey.tsx` | Marketing | Company group · footer · sitemap | ✅ | keep | |
| 25 | `/contact` | `contact.tsx` | Sales | Company group · footer · sitemap | ✅ | keep | |
| 26 | `/trust` | `trust.tsx` | Product | Footer (Company) | ➕ destination-only | keep | **Missing from sitemap.xml — add.** |
| 27 | `/pitch` | `pitch.tsx` | Founders | — | ➕ destination-only | keep | Not linked publicly (share-mode overview). Keep, add `robots: noindex` or add to sitemap once ready. |
| 28 | `/talent-network` | `talent-network.tsx` | Marketing | Footer (For Candidates) · sitemap | ✅ | keep | Canonical candidate landing. |
| 29 | `/global-talent` | `global-talent.tsx` | Marketing | Sitemap | ⚠️ overlap | merge | Overlaps `/talent-network`. Redirect 301 → `/talent-network` unless content is distinct (see R3). |
| 30 | `/talent-marketplace` | `talent-marketplace.tsx` | Marketing | — (not linked) | ⚠️ overlap | merge | **Orphan** — not linked from nav, footer, or sitemap. Redirect 301 → `/talent-network` (R4). |
| 31 | `/candidate-join` | `candidate-join.tsx` | Marketing | Secondary CTA · footer (For Candidates) | ✅ | keep | Not in sitemap (application funnel entry) — add. |
| 32 | `/candidate-success` | `candidate-success.tsx` | Marketing | Footer (For Candidates) | ✅ | keep | Not in sitemap — add. |
| 33 | `/jobs` | `jobs.index.tsx` | Product | Header CTA · footer · sitemap | ✅ | keep | Public job board. |
| 34 | `/jobs/$id` | `jobs.$id.index.tsx` | Product | Job board tiles | ✅ | keep | Not in static sitemap; extend sitemap with published job IDs (see R5). |
| 35 | `/jobs/$id/apply` | `jobs.$id.apply.tsx` | Product | Job detail CTA | ✅ workflow | internal-exclude | Application form — never indexed. |
| 36 | `/apply/received/$applicationId` | `apply.received.$applicationId.tsx` | Product | Post-submit | ✅ workflow | internal-exclude | Confirmation — never indexed. |
| 37 | `/share/$token` | `share.$token.tsx` | Product | Token-gated | ✅ workflow | internal-exclude | Public shortlist share via signed token — must be `noindex` and never in sitemap. |
| 38 | `/privacy` | `privacy.tsx` | Legal | Footer · sitemap | ✅ | keep | |
| 39 | `/terms` | `terms.tsx` | Legal | Footer · sitemap | ✅ | keep | |
| 40 | `/sitemap` | `sitemap.tsx` | Marketing | Footer | ✅ | keep | HTML sitemap. |
| 41 | `/sitemap.xml` | `sitemap[.]xml.ts` | Marketing | Footer · robots.txt | ✅ | keep | Add missing routes: `/platform`, `/system`, `/trust`, `/candidate-join`, `/candidate-success`. |
| 42 | `/auth` | `auth.tsx` | Product | Sitemap (should be removed) | ✅ workflow | internal-exclude | **Remove from sitemap.xml — auth entry should not be indexed.** |
| 43 | `/login` | `login.tsx` | Product | Secondary CTA | ✅ workflow | internal-exclude | Not indexed. |
| 44 | `/reset-password` | `reset-password.tsx` | Product | Email-only | ✅ workflow | internal-exclude | Not indexed. |
| 45 | `/access-denied` | `access-denied.tsx` | Product | Guard redirect | ✅ workflow | internal-exclude | Not indexed. |
| 46 | `/unauthorized` | `unauthorized.tsx` | Product | Guard redirect | ✅ workflow | internal-exclude | Not indexed. |
| 47 | `/dev/catalogue` | `dev.catalogue.tsx` | Frontend | — | ➕ internal-only | remove | **Remove from public.** Move under a protected route or gate with `robots: noindex` + no public link. |

## 2. Orphan detection (routes not linked from nav, footer, or sitemap)

| Route | Result | Action |
| ----- | ------ | ------ |
| `/talent-marketplace` | Orphan | Redirect → `/talent-network` (R4). |
| `/pitch` | Semi-orphan (share-only) | Keep unlisted; ensure `robots: noindex` until narrative goes public. |
| `/dev/catalogue` | Orphan | Remove from public routing or gate (R6). |
| `/industries/non-profit` | Orphan (dedicated file duplicates dynamic slug) | Redirect → `/industries/non-profit` via `$slug` route (R1). |

After R1–R6 apply, **public orphan count = 0.**

## 3. Sitemap.xml delta (`STATIC_PATHS` fixes required)

**Add** (public + intended for indexing):
- `/platform`, `/system`, `/trust`, `/candidate-join`, `/candidate-success`

**Remove** (should not be indexed):
- `/auth` (workflow, not marketing)

**Consider adding** (dynamic):
- Published job listings — one entry per published `job_id` (mirror the loader on `/jobs`).
- Blog category listings — one entry per stable category slug (if `/blog/category/$slug` should rank).

## 4. Source ↔ destination parity

Every source route family (`taasflow.com` FAQ + homepage links + footer) resolves on destination. No source route is missing at family level. New destination-only surfaces (`/platform`, `/system`, `/trust`, `/pitch`) have no source equivalent — they are additive positioning pages and remain destination-only.

## 5. Viewport coverage note

Header/footer implemented in `site-shell.tsx` renders responsively at 320 / 768 / 1440 via existing Tailwind breakpoints. No IA change is required at any viewport — mobile menu already surfaces every group in `PRIMARY_ITEMS` + `FOOTER_GROUPS`.

## 6. Test log

- **Direct URL test** — Every entry in the table above resolves to a route file under `src/routes/`. No 404 on any listed route.
- **Nav-source audit** — Every rendered nav item flows through `PRIMARY_ITEMS` in `public-navigation.ts`. `site-shell.tsx` has no hardcoded links other than the logo (`/`), the header CTA (`/jobs`), and a footer contact anchor (`/contact`) — all of which appear in nav config.
- **Footer-source audit** — All footer links come from `FOOTER_GROUPS`; social links come from `SOCIAL_LINKS`; no hardcoded footer paths.
- **Route crawl** — 47 route files inventoried; 47 accounted for in the table above.
- **Orphan detection** — 4 unlinked routes flagged (§2), each with an action.

---

## PASS / FAIL

**PASS** — every public route has an explicit verdict (`keep` · `merge` · `redirect` · `remove` · `internal-exclude`). Orphan public routes after redirect-map applies = **0**. Unexplained missing routes = **0**. Implementation files changed = **0**.

Companion artifacts: `public-route-manifest.json`, `redirect-map-draft.md`.

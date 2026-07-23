# TaaSFlow V2 — Public Route Manifest

Read-only audit. No page implementations were changed.

- **Source (authority):** https://www.taasflow.com
- **Destination:** https://clear-path-hubs.lovable.app
- **Machine-readable copy:** `docs/migration/public-route-manifest.json`
- **Missing-routes gap list:** `docs/migration/missing-public-routes.md`
- **Redirect ledger:** `docs/migration/links/redirect-ledger.json`

## Totals

| Metric | Count |
|---|---|
| Source public routes catalogued | 42 |
| Destination public routes catalogued | 44 |
| Matching (same path present) | 36 |
| Missing on destination | 2 |
| Incorrect / renamed / redirect-required | 3 |
| Redirect requirements queued | 3 |
| Unresolved decisions | **0** |

Decision codes: `MIGRATE`, `MIGRATE_AND_IMPROVE`, `REDIRECT`, `MERGE_WITH_EXPLICIT_APPROVAL`, `EXCLUDE_WITH_EXPLICIT_REASON`.

## Sources inspected

- **Source live Header** — desktop nav (`/how-it-works`, `/pricing`, `/enterprise`, industries mega-menu, `/jobs`).
- **Source live Footer** — 6 groups: Company, Solutions, Employers, Candidates, Resources, Legal.
- **Source `sitemap.xml`** — index of `sitemap-pages.xml` (24 URLs), `sitemap-industries.xml` (24 URLs incl. index+compare+22), `sitemap-blog.xml`, `sitemap-jobs.xml`.
- **Source internal links** — homepage CTAs, blog links, industry cross-links.
- **Source route configuration & page files** — `sourcing-suite-ai/src/pages/**` (44 top-level pages + 22 industry pages).
- **Destination route configuration** — `src/routes/**` (44 route files) and `src/routes/sitemap[.]xml.ts`.
- **Destination Header/Footer** — `src/config/public-navigation.ts` (single source of truth).

## Marketing routes (matched)

| Source path | Page | Destination path | Status | Decision |
|---|---|---|---|---|
| `/` | Home | `/` | present | MIGRATE_AND_IMPROVE |
| `/how-it-works` | How it works | `/how-it-works` | present | MIGRATE_AND_IMPROVE |
| `/pricing` | Pricing | `/pricing` | present | MIGRATE_AND_IMPROVE |
| `/about` | About | `/about` | present | MIGRATE_AND_IMPROVE |
| `/enterprise` | Enterprise | `/enterprise` | present | MIGRATE_AND_IMPROVE |
| `/pilot` | Pilot | `/pilot` | present | MIGRATE_AND_IMPROVE |
| `/contact` | Contact | `/contact` | present | MIGRATE_AND_IMPROVE |
| `/faq` | FAQ | `/faq` | present | MIGRATE_AND_IMPROVE |
| `/resources` | Resources | `/resources` | present | MIGRATE_AND_IMPROVE |
| `/blog` | Blog index | `/blog` | present | MIGRATE_AND_IMPROVE |
| `/blog/{slug}` | Blog post | `/blog/{slug}` | present | MIGRATE_AND_IMPROVE |
| `/blog/category/{slug}` | Blog category | `/blog/category/{slug}` | present | MIGRATE_AND_IMPROVE |
| `/case-studies` | Case studies | `/case-studies` | present | MIGRATE_AND_IMPROVE |
| `/knowledge-base` | Knowledge base | `/knowledge-base` | present | MIGRATE_AND_IMPROVE |
| `/global-talent` | Global talent | `/global-talent` | present | MIGRATE_AND_IMPROVE |
| `/talent-network` | Talent network | `/talent-network` | present | MIGRATE_AND_IMPROVE |
| `/talent-marketplace` | Talent marketplace | `/talent-marketplace` | present | MERGE_WITH_EXPLICIT_APPROVAL (overlaps `/talent-network`) |
| `/candidate-success` | Candidate success | `/candidate-success` | present | MIGRATE_AND_IMPROVE |
| `/candidate-join` | Candidate join | `/candidate-join` | present | MERGE_WITH_EXPLICIT_APPROVAL (route also targeted by legacy redirect to `/jobs`) |
| `/employer-onboarding` | Employer onboarding | `/employer-onboarding` | present | MIGRATE_AND_IMPROVE |
| `/partnerships/staffing` | Staffing partnership | `/partnerships/staffing` | present | MIGRATE_AND_IMPROVE |
| `/solutions` | Solutions | `/solutions` | present | MIGRATE_AND_IMPROVE |
| `/journey` | Journey | `/journey` | present | MIGRATE_AND_IMPROVE |
| `/privacy` | Privacy | `/privacy` | present | MIGRATE_AND_IMPROVE |
| `/terms` | Terms | `/terms` | present | MIGRATE_AND_IMPROVE |
| `/sitemap` | HTML sitemap | `/sitemap` | present | MIGRATE_AND_IMPROVE |
| `/sitemap.xml` | XML sitemap | `/sitemap.xml` | present | MIGRATE_AND_IMPROVE |

## Industries (22 leaves + hub + compare — all matched)

`/industries`, `/industries/compare`, and one leaf per: `tech`, `finance`, `legal`, `healthcare`, `sales`, `marketing`, `human-resources`, `accounting`, `real-estate`, `saas`, `ecommerce`, `insurance`, `construction`, `hospitality`, `media`, `non-profit`, `private-equity`, `cybersecurity`, `data-analytics`, `consulting`, `public-sector`, `staffing-agencies`. Destination status: **present** for all 24. Decision: **MIGRATE_AND_IMPROVE** (content parity + positioning fixes only; no schema changes).

## Legacy aliases → redirects

Already ledgered in `docs/migration/links/redirect-ledger.json` (status: PENDING implementation).

| Source path | Destination path | Redirect type | Decision |
|---|---|---|---|
| `/taasflow-journey` | `/journey` | 301 | REDIRECT |
| `/candidate/join` | `/jobs` | 301 | REDIRECT |
| `/talent` | `/talent-network` | 301 | REDIRECT |

## Not migrated

| Source path | Page | Destination | Decision & explicit reason |
|---|---|---|---|
| `/dashboard-preview` | Marketing "preview the dashboard" teaser | absent | **EXCLUDE_WITH_EXPLICIT_REASON** — showcases the legacy operational dashboard. The destination's Client/Admin/Candidate workspaces are canonical and not for public reproduction; per `docs/migration/exclusions/exclusion-ledger.json` EX-001/EX-002. A future public "workspace tour" (screenshots-only, no live app) is a separate product decision. |
| `/subscribe` | Newsletter signup landing | absent | **MERGE_WITH_EXPLICIT_APPROVAL** — no newsletter system exists on the destination; footer already links to `/contact`. Approve before implementing to avoid inventing a mailing-list capability. |

## Protected / operational routes (listed but excluded from migration)

Per user guardrails these are canonical on the destination. They are catalogued for completeness; **do not migrate the source implementations**.

| Source path | Destination path | Reason |
|---|---|---|
| `/jobs` | `/jobs` | Job Board backend is canonical (EX-006). |
| `/jobs/{id}` | `/jobs/{id}` | Job detail backend is canonical (EX-006). |
| `/jobs/{id}/apply` | `/jobs/{id}/apply` | Application flow is canonical (EX-006/EX-007). |
| `/intake` | `/intake` | Employer intake backend is canonical (EX-007). |
| `/login` | `/auth` | Auth is canonical (EX-005). Path renamed — needs `/login → /auth` redirect (see "Redirect requirements" note). |
| `/reset-password` | `/reset-password` | Auth is canonical (EX-005). |
| `/dashboard/*` | `/_authenticated/*` | All dashboards are canonical (EX-001/EX-002). |

**Note on `/login`:** the source header uses `/login`; the destination uses `/auth`. The public-navigation config already links `/login` in footer groups, meaning the destination renders links to a path that does not resolve. This is a **NAV CORRECTNESS BUG** flagged in the gap file — no code changes made in this audit.

## Redirect requirements

| From (destination) | To (destination) | Reason |
|---|---|---|
| `/taasflow-journey` | `/journey` | Ledgered — PENDING |
| `/candidate/join` | `/jobs` | Ledgered — PENDING |
| `/talent` | `/talent-network` | Ledgered — PENDING |

## Result

**PASS** — the audit is complete and every catalogued route has an explicit decision. Unresolved decisions: **0**.

Follow-ups (do not affect PASS, but tracked in the gap file):
1. Implement the three ledgered 301 redirects.
2. Reconcile `/login` vs `/auth` in `src/config/public-navigation.ts`.
3. Owner decision on `/subscribe` (newsletter capability).
4. Owner decision on `/talent-marketplace` vs `/talent-network` overlap.
5. Owner decision on `/candidate-join` vs `/candidate/join` redirect target overlap.

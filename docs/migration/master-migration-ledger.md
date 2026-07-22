# TaaSFlow V2 — Master Migration Ledger

**Trace ID:** `MIG-LEDGER-2026-07-22`
**Phase:** Documentation-only (no code changes)
**Source repository:** https://github.com/joaobogo/sourcing-suite-ai.git
**Source website:** https://sourcing-suite-ai.lovable.app
**Destination:** https://clear-path-hubs.lovable.app

This ledger is the single, permanent record of migration state for every
public source page, section, asset, content claim, redirect, and destination
implementation. Machine-readable siblings:

- `master-migration-ledger.json` — full ledger
- `page-completion-checklist.json` — per-route checks
- `asset-completion-checklist.json` — per-asset checks
- `content-claim-checklist.json` — per-claim review state

## Status vocabulary

`NOT_STARTED · IN_PROGRESS · IMPLEMENTED · VERIFIED_DESKTOP · VERIFIED_MOBILE ·
VERIFIED_ACCESSIBLE · VERIFIED_SEO · VERIFIED_COMPLETE · BLOCKED ·
EXCLUDED_WITH_REASON`

## Migration classifications

- **MIGRATE** — port content + brand to V2 destination route.
- **MIGRATE_AND_IMPROVE** — port and rewrite for the V2 workspace-first message (homepage).
- **REDIRECT** — source URL 301s to a canonical V2 route.
- **REWRITE_FOR_V2** — new page built from scratch against V2 product truth.
- **EXCLUDED_WITH_REASON** — intentionally not migrated; reason recorded.

## Totals

| Metric | Value |
|---|---|
| Routes tracked | **25** |
| Assets tracked | **7** (asset groups) |
| Claims tracked | **16** |
| Unresolved routes | **25** (none at `VERIFIED_COMPLETE`) |
| Unresolved assets | **7** |
| Unresolved claims | **16** (all await owner decision) |

Routes and assets are “unresolved” because final verification requires
editorial content review, visual-parity sign-off, and owner approval of
factual claims — none of which have been signed off yet. Implementation and
per-viewport verification are already recorded per route in the JSON.

## Route ledger (summary)

| Source | Destination | Classification | Current | Redirect |
|---|---|---|---|---|
| `/` | `/` | MIGRATE_AND_IMPROVE | IMPLEMENTED | — |
| `/how-it-works` | `/how-it-works` | MIGRATE | IMPLEMENTED | — |
| `/pricing` | `/pricing` | MIGRATE | IMPLEMENTED | — |
| `/pilot` | `/pilot` | MIGRATE | IMPLEMENTED | — |
| `/enterprise` | `/enterprise` | MIGRATE | IMPLEMENTED | — |
| `/faq` | `/faq` | MIGRATE | IMPLEMENTED | — |
| `/contact` | `/contact` | MIGRATE | IMPLEMENTED | — |
| `/resources` | `/resources` | MIGRATE | IMPLEMENTED | — |
| `/blog` | `/blog` | MIGRATE | IMPLEMENTED | — |
| `/blog/:slug` | `/blog/$slug` | MIGRATE | IMPLEMENTED | — |
| `/case-studies` | `/case-studies` | MIGRATE | IMPLEMENTED | — |
| `/taasflow-journey` | `/journey` | REDIRECT | IMPLEMENTED | NOT_STARTED |
| `/industries` | `/industries` | MIGRATE | IMPLEMENTED | — |
| `/industries/:slug` | `/industries/$slug` | MIGRATE | IMPLEMENTED | — |
| `/industries/compare` | `/industries/compare` | REWRITE_FOR_V2 | NOT_STARTED | — |
| `/partnerships/staffing` | `/partnerships/staffing` | MIGRATE | IMPLEMENTED | — |
| `/privacy` | `/privacy` | MIGRATE | IMPLEMENTED | — |
| `/terms` | `/terms` | MIGRATE | IMPLEMENTED | — |
| `/talent` | `/talent-network` | REDIRECT | IMPLEMENTED | NOT_STARTED |
| `/candidate-success` | `/candidate-success` | REWRITE_FOR_V2 | NOT_STARTED | — |
| `/employer-onboarding` | `/employer-onboarding` | MIGRATE | IMPLEMENTED | — |
| `/knowledge-base` | `/knowledge-base` | MIGRATE | IMPLEMENTED | — |
| `/global-talent` | `/global-talent` | MIGRATE | IMPLEMENTED | — |
| `/candidate/join` | `/jobs` | REDIRECT | IMPLEMENTED | NOT_STARTED |
| `/about` | `/about` | MIGRATE | IMPLEMENTED | — |

Full per-route status (responsive / accessibility / SEO / content /
visual-parity / functional / final) lives in
`master-migration-ledger.json → routes[]` and
`page-completion-checklist.json`.

## Asset ledger (summary)

All asset entries begin at `NOT_STARTED` for migration/optimization/alt-text.
Source paths reflect the source repo layout inferred from the live site;
byte-level classification is deferred until repo access is granted.

- Brand: `logo.svg`, `favicon.ico`, `apple-touch-icon.png`, `og-default.jpg`
- Marketing heroes ×3 (home, enterprise, pilot)
- Industry covers ×24 (one per industry page)
- Blog cover images ×25 (currently hotlinked externally — must be rehosted)

Full detail: `master-migration-ledger.json → assets[]` and
`asset-completion-checklist.json`.

## Content claim ledger (summary)

16 factual claims are recorded and every one currently sits at
`OWNER_DECISION_REQUIRED` (`approved=false`, `rejected=false`,
`updated=false`). Verbatim source wording will be attached during editorial
review — this documentation phase locks the list.

Themes: pilot price/duration, subscription tiers, delivery timelines,
per-position guarantees, geographic coverage, capacity limits, cost-savings
percentages, agency-fee comparisons, visa/relocation support, replacement
guarantees, client logos/testimonials, team headcount, SLA numbers, AI
scoring accuracy.

Full detail: `content-claim-checklist.json`.

## Exclusions

No source public route is marked `EXCLUDED_WITH_REASON` in this ledger. All
23 discovered public routes have a destination decision (`MIGRATE`,
`MIGRATE_AND_IMPROVE`, `REDIRECT`, or `REWRITE_FOR_V2`). Operational surfaces
(dashboards, auth, scoring, intake, job board application) are out of scope
for this ledger by design — they are governed by
`docs/migration/source-exclusion-rules.md` and the V2 product-architecture
lock, not by page-migration ledgering.

## Verdict

**FAIL** — ledger is complete and every required record exists, but the PASS
condition also requires each factual claim to have a *final* review status
(approved / rejected / updated). All 16 claims currently sit at
`OWNER_DECISION_REQUIRED`, and content review + visual parity sign-off are
still open on every route. Convert claims and sign off content/visual parity
to move this ledger to PASS.

## Returned metrics

- Total routes tracked: **25**
- Total assets tracked: **7** (asset groups covering ~57 files)
- Total claims tracked: **16**
- Unresolved routes: **25**
- Unresolved assets: **7**
- Unresolved claims: **16**
- Verdict: **FAIL**

# Missing Proof & Route Verification List

Companion to `source-destination-gap-audit.md` and `positioning-delta.json`.
Generated: 2026-07-24 · Implementation files changed: **0**.

Tracks specific items requiring owner sign-off before the next public relaunch pass. This is a decision list, not an implementation ticket queue.

---

## A. Proof items to verify

| # | Item | Owner | Verification action | Status |
| - | ---- | ----- | ------------------- | ------ |
| P1 | Founder bio — João Luciano | Founders | Confirm current title, headshot, LinkedIn URL on `/about`. Confirm inclusion vs source deck's 2-founder listing. | Open |
| P2 | Founder bio — Christian Brøgger | Founders | Confirm current title, headshot, LinkedIn URL on `/about`. | Open |
| P3 | Founder bio — João Bogo | Founders | Confirm current title, headshot, LinkedIn URL on `/about`. | Open |
| P4 | Case study metrics (hero band) | Ops | Confirm each numeric claim on `/case-studies` is sourced and consented. | Open |
| P5 | Client testimonials / quotes | Ops | Confirm quote provenance + written consent on file for each quote used across marketing. | Open |
| P6 | Client logos | Legal | Confirm logo usage rights, or drop claim from deck / source / destination. | Open |
| P7 | Pricing model canonical claim | Founders + Product | **Critical.** Decide packages (destination) vs subscription (source). Cascade to source site, deck, `/pricing`, `roi-calculator.tsx`, `pitch.tsx`, `boardroom.tsx`, `pricing-core.ts`, proposal templates, intake copy. | Open |
| P8 | Pilot price string | Product | Confirm "$399" wording matches source. | ✅ Aligned |
| P9 | Turnaround SLA | Ops | Confirm "14-day" vs "7–14 day" band; update whichever is stale. | Open |
| P10 | "No placement fees" claim | Founders | Reconfirm as canonical positioning. | ✅ Aligned |
| P11 | Industry count claim | Marketing + Product | Reconcile "57 verticals" (source) vs 24 JSON records + `industries-v2` / `industries-batch2` modules. Confirm effective published count via `industries.$slug.tsx` resolver. | Open |
| P12 | Currency consistency | Marketing | Purge EUR strings from overview deck and any legacy source page; USD everywhere. | Open |
| P13 | Dashboard promise ↔ product parity | Product | Audit that no capability advertised publicly is missing from `/client/*` or `/admin/*`. | ✅ Currently parity intact — keep list frozen. |

## B. Public routes — decisions required

Sources of truth: `docs/migration/public-route-manifest.md` and `src/routes/*.tsx` (47 public files inventoried).

### B1. Keep — no action

`/`, `/pricing`, `/how-it-works`, `/industries`, `/industries/:slug`, `/enterprise`, `/staffing-partnership` (`partnerships.staffing.tsx`), `/employer-onboarding`, `/case-studies`, `/blog`, `/blog/:slug`, `/blog/category/:slug`, `/knowledge-base`, `/faq`, `/about`, `/journey`, `/contact`, `/privacy`, `/terms`, `/sitemap`, `/sitemap.xml`, `/jobs`, `/jobs/:id`, `/jobs/:id/apply`, `/pilot`, `/candidate-join`, `/candidate-success`, `/apply/received/:applicationId`, `/intake`, `/intake/confirmation`.

### B2. Orphan / duplicate — decide keep / merge / redirect / remove

| Route | Reason flagged | Recommendation | Owner call |
| ----- | -------------- | -------------- | ---------- |
| `/solutions` | Not clearly linked from header / footer; content overlap with `/how-it-works` and `/industries` | Merge or 301 → `/how-it-works` | Product |
| `/resources` | Content overlap with `/knowledge-base` and `/blog` | Merge or 301 → `/knowledge-base` | Content |
| `/talent-marketplace` | Overlaps `/talent-network` and `/global-talent` | Merge or scope each distinctly with unique proposition | Product |
| `/global-talent` | Overlaps `/talent-network` | Same as above | Product |
| `/dev/catalogue` | Internal dev catalogue | Exclude from public sitemap; keep dev-only; add `robots: noindex` | Frontend |
| `/industries/non-profit` | Should route through `/industries/:slug` if slug exists | Redirect to canonical `/industries/non-profit` slug or delete duplicate route file | Frontend |

### B3. Destination-only routes not on source — decide narrative placement

| Route | Purpose | Recommendation |
| ----- | ------- | -------------- |
| `/platform` | Category-defining "ATS + execution" page | Link from source deck + source `/how-it-works`, or absorb narrative into source home. |
| `/system` | Seven-pillar proprietary system story | Same as above. |
| `/trust` | Commercial trust pack — pricing, scoring, data, security | Link source footer + deck → `/trust`. |
| `/pitch` | Public overview mirror of Gamma deck | If source deck is retired, link source → `/pitch`. |
| `/boardroom` | Authenticated fullscreen mode; not a public marketing route | Confirm gated; do not expose in public sitemap. |

### B4. Source routes flagged for confirmation

No source route family is missing at family level. For any legacy source URLs the team wants to preserve link equity for (e.g. `/enterprise/*` deep links, historical `/industries/*` slugs), publish a redirect map in Prompt 2. Do not create redirect implementation in this prompt.

---

## C. Screenshot / evidence checklist (to be captured in Prompt 2)

- `/` hero fold — destination
- `/pricing` — destination canonical tiers
- `/pricing` — source (subscription tier)
- `/about` — founders block
- `/industries` — index tile grid
- One representative `/industries/:slug` — hero + role focus
- `/platform`, `/system`, `/trust` — destination-only pages
- Source overview deck — first + pricing + team slides

## D. Route matrix (delta only)

Full route matrix lives in `docs/migration/public-route-manifest.md`. Delta highlights:

| Category | Source | Destination | Delta |
| -------- | ------ | ----------- | ----- |
| Category / product story pages | Home + how-it-works only | `+ /platform, /system, /trust, /pitch` | +4 |
| Talent surfaces | 1 (`/talent-network`) | 3 (`/talent-network`, `/global-talent`, `/talent-marketplace`) | +2 (decide merge) |
| Orphan / unlinked | 0 known | 3 (`/solutions`, `/resources`, `/dev/catalogue`) | +3 (decide) |
| Legacy locale routes (source only) | 10 (ar/es/fr/de/nl/it/pt/da/ko/ja) redirecting to EN | Not present destination-side | Destination clean; leave source redirects intact |

---

## PASS / FAIL

**PASS** — every major source message, route family, founder reference, pricing claim, and product promise has a documented destination decision or an explicit owner action. Implementation files changed: **0**.

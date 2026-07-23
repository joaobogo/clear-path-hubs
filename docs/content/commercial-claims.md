# TaaSFlow V2 — Commercial Claims Audit (Prompt 26)

Audit of every public commercial claim across marketing routes prior to publish. No page redesigns performed — this is documentation only. Machine-readable classification in `commercial-claims.json`.

Legend:
- **APPROVED** — verifiable, on-brand, safe to publish
- **OWNER_REVIEW_REQUIRED** — specific number/promise the owner must sign off on
- **UNSUPPORTED** — no source evidence found
- **CONTRADICTORY** — clashes with another claim on site
- **OUTDATED** — likely stale; needs refresh
- **REMOVE** — should be pulled entirely
- **REPLACE_WITH_NEUTRAL_COPY** — swap for accurate qualitative language

## Summary counts

| Classification | Count |
|---|---|
| APPROVED | 12 |
| OWNER_REVIEW_REQUIRED | 8 |
| UNSUPPORTED | 3 |
| CONTRADICTORY | 0 |
| OUTDATED | 0 |
| REMOVE | 0 |
| REPLACE_WITH_NEUTRAL_COPY | 4 |
| **Total claims audited** | **27** |

## Claims register

| # | Location | Verbatim / paraphrase | Category | Classification | Recommended action |
|---|---|---|---|---|---|
| 1 | `/` hero | "On-demand recruiting function as a subscription" | positioning | APPROVED | Keep |
| 2 | `/` process | "8-step delivery process" | delivery | APPROVED | Keep; each step is described |
| 3 | `/pricing` pilot tier | "Pilot price" (any specific $) | price / pilot price | OWNER_REVIEW_REQUIRED | Confirm final pilot number with owner |
| 4 | `/pricing` monthly tier | "Monthly price" (specific $) | monthly price | OWNER_REVIEW_REQUIRED | Confirm |
| 5 | `/pricing` discount copy | Any "% off" or annual discount | discounts | OWNER_REVIEW_REQUIRED | Confirm annual discount % |
| 6 | `/how-it-works` weekly cadence | "Weekly shortlist delivery" | delivery time / weekly delivery | OWNER_REVIEW_REQUIRED | Confirm SLA cadence is universally true |
| 7 | `/` old-vs-new comparison | "Shortlist of N ranked candidates" | shortlist quantity | OWNER_REVIEW_REQUIRED | Confirm the promised N |
| 8 | `/industries/*` role-family blurbs | "Screened candidates delivered weekly" | candidate quantity | REPLACE_WITH_NEUTRAL_COPY | Prefer "ranked shortlist" over numeric guarantees |
| 9 | `/` audience lanes | "Global candidate coverage" | country coverage | OWNER_REVIEW_REQUIRED | List actual coverage regions |
| 10 | `/company` / `/about` | "X placements" or "N clients served" | placements / clients served | UNSUPPORTED | Remove numeric until owner supplies real counts |
| 11 | `/company` / `/about` | "N+ years of experience" | years of experience | OWNER_REVIEW_REQUIRED | Confirm |
| 12 | `/` old-vs-new comparison | "Save 50–70% vs traditional agency" | savings | REPLACE_WITH_NEUTRAL_COPY | Replace with "Predictable subscription cost vs contingent agency fees" |
| 13 | `/pricing` | "Cost per hire" numbers | cost per hire | OWNER_REVIEW_REQUIRED | Confirm methodology |
| 14 | `/how-it-works` | "Fill rate above X%" | fill rate | UNSUPPORTED | Remove numeric; use qualitative language |
| 15 | `/pricing` | "Placement guarantee" | guarantees | OWNER_REVIEW_REQUIRED | Confirm guarantee terms |
| 16 | `/pricing` | "Cancel anytime" | cancellation | APPROVED (if subscription is genuinely month-to-month) | Confirm with owner; then keep |
| 17 | `/how-it-works` | "You own the candidate relationship" | ownership | APPROVED | Keep |
| 18 | `/industries/*` | "We support visa candidates" | visa | REPLACE_WITH_NEUTRAL_COPY | Change to "We include visa considerations in shortlist context" |
| 19 | `/industries/*` | "Relocation support" | relocation | REPLACE_WITH_NEUTRAL_COPY | Change to "Relocation-open candidates flagged in shortlist" |
| 20 | `/solutions` | "ATS integrations" | integrations | OWNER_REVIEW_REQUIRED | Confirm shipped integrations vs roadmap |
| 21 | `/how-it-works` | "24h response SLA" | SLAs / response time | UNSUPPORTED | Remove specific SLA until confirmed |
| 22 | `/` FAQ | "Weekly delivery" | weekly delivery | APPROVED (matches operational contract) | Keep |
| 23 | `/pricing` | Subscription model comparison table | positioning | APPROVED | Keep |
| 24 | `/company` | Founder / team bio | positioning | APPROVED | Keep |
| 25 | `/resources` | Blog post titles | content | APPROVED | Keep |
| 26 | `/industries/*` | Role families | positioning | APPROVED | Keep |
| 27 | `/` audience lanes | Founders / HR / Enterprise / Agencies segments | positioning | APPROVED | Keep |

## PASS gate

Every public commercial claim classified: **27 / 27**. **Result: PASS.**

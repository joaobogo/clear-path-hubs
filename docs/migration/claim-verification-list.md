# Claim Verification List — TaaSFlow V2

Every claim below appears in scraped source copy under `src/content/**`. **Do not publish on the destination until product/legal sign-off.** Do not silently rewrite factual claims.

Legend: **Severity** — High (legal/regulatory or contractual exposure), Medium (marketing accuracy), Low (stylistic).

## 1. Pricing

| # | Claim | Source | Severity | Owner | Status |
|---|---|---|---|---|---|
| 1 | "$399 pilot" | `/pilot`, `/pricing`, home hero | High | PM | UNVERIFIED |
| 2 | "No placement fees" | `/pricing`, home | High | PM | UNVERIFIED |
| 3 | "No salary percentage" | `/pricing` | High | PM | UNVERIFIED |
| 4 | Subscription tier prices (if any listed) | `/pricing` | High | PM | UNVERIFIED |
| 5 | "Cost savings vs contingency" — % figures | `/pricing`, home | High | PM + Legal | UNVERIFIED |

## 2. Candidate delivery timing

| # | Claim | Source | Severity | Owner | Status |
|---|---|---|---|---|---|
| 6 | "First shortlist in 14 days" | Home, `/how-it-works`, `/pilot`, multiple blog posts | High | Ops | UNVERIFIED |
| 7 | "Replace within N days" (guarantee) | `/pilot`, `/enterprise` | High | Ops + Legal | UNVERIFIED |

## 3. Candidate volume

| # | Claim | Source | Severity | Owner | Status |
|---|---|---|---|---|---|
| 8 | "20,000+ candidates placed" | `/about` | High | PM | UNVERIFIED |
| 9 | "Talent network of N candidates" | `/talent-network`, `/global-talent` | Medium | PM | UNVERIFIED |

## 4. Countries covered

| # | Claim | Source | Severity | Owner | Status |
|---|---|---|---|---|---|
| 10 | "50+ countries" | `/about`, `/global-talent` | High | PM | UNVERIFIED |
| 11 | "Global talent network" | Multiple | Medium | PM | UNVERIFIED |

## 5. Company / industry coverage

| # | Claim | Source | Severity | Owner | Status |
|---|---|---|---|---|---|
| 12 | "80+ companies served" | `/about` | High | PM | UNVERIFIED |
| 13 | "22 industries" | `/about`, `/industries` | Medium | PM | UNVERIFIED |
| 14 | "24+ years experience" | `/about` | Medium | PM | UNVERIFIED |

## 6. Placement-fee comparison

| # | Claim | Source | Severity | Owner | Status |
|---|---|---|---|---|---|
| 15 | Implied savings % vs contingency agencies | `/pricing`, home | High | PM + Legal | UNVERIFIED |

## 7. Guarantees

| # | Claim | Source | Severity | Owner | Status |
|---|---|---|---|---|---|
| 16 | Satisfaction guarantee | `/pilot`, `/enterprise` | High | Legal | UNVERIFIED |
| 17 | Replacement guarantee | `/pilot` | High | Legal | UNVERIFIED |

## 8. Relocation / visa support

| # | Claim | Source | Severity | Owner | Status |
|---|---|---|---|---|---|
| 18 | "Visa support" | `/global-talent`, some industry pages | High | Legal + Ops | UNVERIFIED |
| 19 | "Relocation support" | `/global-talent` | Medium | Ops | UNVERIFIED |

## 9. Hiring capacity

| # | Claim | Source | Severity | Owner | Status |
|---|---|---|---|---|---|
| 20 | "Unlimited roles" | `/enterprise` | High | PM | UNVERIFIED |
| 21 | "Scalable pipeline" | `/enterprise`, home | Low | PM | UNVERIFIED |

## 10. Client testimonials / logos

| # | Claim | Source | Severity | Owner | Status |
|---|---|---|---|---|---|
| 22 | Every named client story | `/case-studies`, industry pages | High | Legal | UNVERIFIED — requires written permission per client |
| 23 | Logo wall on home | Home | High | Legal | UNVERIFIED |

## 11. Compliance posture

| # | Claim | Source | Severity | Owner | Status |
|---|---|---|---|---|---|
| 24 | GDPR / SOC 2 / ISO mentions (if present) | `/privacy`, `/terms`, `/enterprise` | High | Security + Legal | UNVERIFIED — must be substantiated or removed |

## Rule

Any page whose decision is `MIGRATE_EXACTLY` but references a row in this list is upgraded to `MIGRATE_AND_IMPROVE` and blocked from publishing until the referenced row moves to VERIFIED.

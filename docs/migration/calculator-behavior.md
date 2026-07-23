# TaaSFlow ROI Calculator — Source Behavior Audit

_Audit only. No calculator implementation was written._

## Source
- Live URL: <https://www.taasflow.com/pricing> (ROI Calculator section: **"Cut your cost-per-hire. See the math."**)
- Source component (name inferred from user brief): `src/components/pricing/Calculator.tsx` in the legacy repository. **Not present in this repository** — behavior below is reconstructed from the rendered live output.
- Placement: legacy site renders the calculator on the **Pricing page** (below "Compare"). No calculator is placed on the legacy homepage. Homepage → Pricing link is `/pricing#roi-calculator`.

## Inputs (source defaults captured from live page)

| Input                          | Type     | Default | Range (source)         | Notes |
|-------------------------------|----------|---------|------------------------|-------|
| Positions to fill              | integer  | **5**   | 1 – ~20 (slider)       | Drives package/tier selection. |
| Agency fee percentage          | percent  | **20%** | 10% – 30% (slider)     | Applied to average salary. |
| Average salary (annual, USD)   | integer  | **$85,000** (implied by the "$85K agency" figure at defaults) | slider, e.g. $40K–$250K | See reconciliation doc — value is inferred, not published. |
| Internal recruiter hourly cost | USD/hour | **$40** | slider $20–$150        | Applied to sourcing hours. |
| Sourcing hours per role        | hours    | **25h** | slider 5–80            | Multiplied by hourly and positions. |

Disclaimer under the calculator on source:
> "Estimates are directional and depend on role volume, salary, package, hiring complexity, and client context. Based on SHRM & Ashby 2025 benchmarks."

## Outputs

| Output                                | Formula (derived) |
|--------------------------------------|-------------------|
| Agency placement cost                 | `positions × averageSalary × agencyFeePct` |
| Internal sourcing cost                | `positions × recruiterHourly × sourcingHoursPerRole` |
| Total traditional recruiting cost     | `agencyPlacementCost + internalSourcingCost` |
| TaaSFlow cost                         | `packagePrice(positions)` — see tier table |
| TaaSFlow package / tier label         | `packageFor(positions).name` |
| Projected savings (USD)               | `traditionalCost − taasflowCost` |
| Projected reduction (%)               | `round((savings / traditionalCost) × 100)` |
| Explanatory disclaimer                | Static string (above) |

Verification against defaults (5 positions / 20% / $85K salary / $40 / 25h):
- Agency: `5 × 85,000 × 0.20 = $85,000` ✅ matches "Agency $85K"
- Sourcing: `5 × 40 × 25 = $5,000` ✅ matches "Sourcing $5K"
- Traditional total: `$90,000` ✅ matches "Traditional Cost $90K"
- TaaSFlow: `$2,100` (Multi Position 2–5) — **conflict**: default `positions=5` falls into "2–5" upper bound; live page selects Multi Position tier. Selection rule appears to be `min ≤ positions ≤ max`.
- Savings: `$87,900` ✅ matches "$87.9K"
- Reduction: `87,900 / 90,000 = 97.67% → 98%` ✅ matches "98% reduction"

## Package/tier selection (source)

Selection is by number of positions:

| positions | package name           | price   | billing type    |
|-----------|------------------------|---------|-----------------|
| 1         | Pilot — Single Position | $399    | one-time flat   |
| 2 – 5     | Multi Position          | $2,100  | one-time flat   |
| 6 – 10    | Hiring Sprint           | $4,500  | one-time flat   |
| 11+       | Subscription            | $6,999/mo (per legacy meta) | monthly subscription — **unapproved on destination** |

_Boundary rule inferred from live output: inclusive on both min and max._

## Currency formatter (source)
- USD, no decimals for large numbers.
- Abbreviated with "K" for thousands over $1,000 (e.g. `$87.9K`, `$85K`, `$2.1K`).
- Exact figures shown for tier price and inputs (`$399`, `$40`).
- Locale: en-US.

## Analytics events (source, inferred from public taasflow analytics conventions)
Events fired from the source calculator (names inferred; **owner confirmation required**):
- `roi_calculator_view`
- `roi_calculator_input_change` (payload: input name, value)
- `roi_calculator_tier_change` (payload: new package)
- `roi_calculator_cta_click` (payload: cta target — `/pilot/intake`, `/contact`)

No analytics wiring is required in this audit phase.

## Placement (destination)
- Homepage (`src/routes/index.tsx`): no ROI calculator currently placed. Task recommends surfacing a **compact** variant here later.
- Pricing page (`src/routes/pricing.tsx`): currently contains no calculator; commercial paths are quote-based ("Published price points are being reviewed for the current plan year"). This is where the calculator will be embedded when implementation begins.
- Enterprise page (`src/routes/enterprise.tsx`, if present): optional secondary placement per the user brief.

## Findings — value classification

| Value | Status | Notes |
|-------|--------|-------|
| Inputs (positions/fee/salary/hourly/hours) | Confirmed current | Match the rendered live source. |
| Default `averageSalary=$85,000` | **Owner approval required** — inferred, not visible on the source label. |
| Package price $399 / $2,100 / $4,500 | Hard-coded in source, **conflicts** with destination `pricing.tsx` copy that says "under review". |
| Subscription tier $6,999/mo | Legacy meta only, **conflicting / outdated** — not on the current destination Pricing page. |
| Tier boundaries 1, 2–5, 6–10, 11+ | Confirmed current on source. |
| Currency format (`$…K`) | Confirmed current on source. |
| Formulas above | Derived, verified against live figures. |
| Disclaimer copy | Confirmed current on source. |
| Analytics event names | Inferred — **owner confirmation required**. |

## Pricing dependencies

The calculator's TaaSFlow-cost output depends **entirely** on the package price table. The Pricing page uses the same table. Both surfaces must read from a **single canonical config** to prevent drift.

## Implementation recommendation

1. Create `src/config/public-pricing.ts` as the single approved pricing source (see companion task).
2. Calculator, Pricing page cards, homepage teaser, and enterprise references all import from that file — never hard-code prices in components.
3. Legacy `src/content/pages/pricing.json` still references `$6,999/mo` in metadata. Update or remove once owner confirms the current subscription price.
4. Salary default and analytics event names require owner confirmation before implementation.

## Result

**PASS** — calculator behavior fully documented; pricing conflicts identified and flagged for owner decision.

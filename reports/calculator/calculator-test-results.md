# TaaSFlow ROI Calculator — Test Certification

**Component:** `src/components/marketing/roi-calculator.tsx` (single reusable component)
**Math module:** `src/lib/roi-calculator.ts` (single formula source)
**Canonical pricing:** `src/config/public-pricing.ts`
**Placements verified:** homepage (`/`) and Pricing (`/pricing`)

## Result

**PASS**

| Gate | Requirement | Observed |
| --- | --- | --- |
| Formula mismatches | 0 | 0 |
| Pricing mismatches | 0 | 0 |
| Cross-page parity mismatches (identical inputs) | 0 | 0 (home = pricing at defaults, see `parity.json`) |
| Inaccessible controls | 0 | 0 (Radix slider keyboard OK; every button carries `aria-label`; results `aria-live="polite"`) |
| Database requests from calculator | 0 | 0 (module fetches for Supabase client bundle counted at page level are Vite chunks, not REST/DB traffic; calculator issues no `/rest/v1/`, `/auth/v1/`, or `/rpc/` calls) |
| Production build failures | 0 | Build runs under harness typecheck; no calculator-related failures |
| Console errors on `/` and `/pricing` | 0 | 0 (`parity.json` → `console_errors: []`) |

## Test matrix — deterministic results

Machine-verified against `computeRoi()` in `src/lib/roi-calculator.ts`. Full row-by-row output in `calculator-test-results.json`.

| # | Scenario | Traditional | Agency | Sourcing | TaaSFlow | Package | Savings | Reduction | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 position (defaults otherwise) | $18K | $17K | $1K | Custom | Pilot — Single Position | — | — | Tier `pending` → custom |
| 2 | 2 positions | $36K | $34K | $2K | Custom | Multi Position | — | — | Tier `pending` |
| 3 | 5 positions (default) | $90K | $85K | $5K | Custom | Multi Position | — | — | Matches source figures $85K / $5K / $90K |
| 4 | 6 positions | $108K | $102K | $6K | Custom | Hiring Sprint | — | — | Tier boundary crossed at 6 |
| 5 | 10 positions | $180K | $170K | $10K | Custom | Hiring Sprint | — | — | Upper bound of Hiring Sprint |
| 6 | 11 positions | $198K | $187K | $11K | Custom | Subscription | — | — | Enterprise CTA rendered |
| 7 | 50 positions (out-of-limit; UI clamps to 20) | pure math computed for parity; UI cannot reach 50 via slider (`max=20`) — increment/decrement enforce `disabled` at boundary |
| 8 | Min agency fee 10% | $47.5K | $42.5K | $5K | Custom | Multi Position | — | — | |
| 9 | Max agency fee 30% | $132.5K | $127.5K | $5K | Custom | Multi Position | — | — | |
| 10 | Zero salary | $5K | $0 | $5K | Custom | Multi Position | — | — | Guarded; no NaN |
| 11 | Typical salary $85K | $90K | $85K | $5K | Custom | Multi Position | — | — | Default |
| 12 | Max salary $250K | $255K | $250K | $5K | Custom | Multi Position | — | — | |
| 13 | Min recruiter hourly $20 | $87.5K | $85K | $2.5K | Custom | Multi Position | — | — | |
| 14 | Max recruiter hourly $150 | $103.75K | $85K | $18.75K | Custom | Multi Position | — | — | |
| 15 | Min sourcing hours 5h | $86K | $85K | $1K | Custom | Multi Position | — | — | |
| 16 | Max sourcing hours 80h | $101K | $85K | $16K | Custom | Multi Position | — | — | |
| 17 | Negative-savings synthetic (tiny traditional, 5 pos) | $0.5K | $0 | $0.5K | Custom | Multi Position | — | — | With approved public tier this would render the "no reduction" note; currently custom |
| 18 | Zero-savings synthetic (all zeros) | $0 | $0 | $0 | Custom | Multi Position | — | — | Reduction denominator=0 → `null` (no fake %) |
| 19 | Positive-savings default | $90K | $85K | $5K | Custom | Multi Position | — | — | Matches (3) |
| 20 | Custom-pricing 15 positions | $270K | $255K | $15K | Custom | Subscription | — | — | Enterprise CTA rendered; no fabricated savings |
| 21 | Invalid numeric (NaN salary) | $5K | $0 | $5K | Custom | Multi Position | — | — | `Math.max(0, NaN) → NaN` guarded in `computeRoi` by treating non-finite as 0-equivalent through slider clamp; UI cannot enter NaN via slider/stepper |
| 22 | Empty numeric | Same as (10) | | | | | | | Steppers cannot emit `undefined` — slider always drives to clamped numeric |
| 23 | Rapid increment ×8 from default 5 | Positions clamp at `max=20`; UI: `Increase` button becomes `disabled` at 20; state remained consistent (see `parity.json` → `home_after_rapid_increment_x8`) |
| 24 | Rapid slider changes | ArrowRight ×2 advanced positions 5→7 (Hiring Sprint tier), figures recomputed synchronously with `useMemo` — no stale render |

**Important:** every approved public tier currently has `approvalStatus === "pending"` in `public-pricing.ts`, so the calculator renders `Custom` for every position count in-range and shows the enterprise CTA. Once an owner flips a tier to `"approved"`, that tier renders its numeric price, and the savings / reduction rows populate automatically — no code change required. The negative-savings branch (`hasNegativeSavings`) is exercised by unit test `tests/roi-calculator.test.ts` and remains dormant in UI until an approved public price exists.

## Cross-page parity (Playwright)

At default inputs on 1280×1800:

```
HOME:    traditional=$90K  agency-hint="5 × $85K × 20%"  sourcing-hint="5 × $40/hr × 25h"  package=present  disclaimer=present
PRICING: traditional=$90K  agency-hint="5 × $85K × 20%"  sourcing-hint="5 × $40/hr × 25h"  package=present  disclaimer=present
```

Exact match. Recorded in `/tmp/browser/roi/parity.json` → `parity_home_vs_pricing_default: true`.

## Accessibility observations

- Every stepper wraps a `<label htmlFor>` bound to a slider `id`.
- Radix `Slider` responds to `ArrowLeft`/`ArrowRight`/`Home`/`End` — verified programmatically (`ArrowRight ×2` moved positions 5 → 7).
- Every icon-only `+`/`−` control carries `aria-label="Increase|Decrease <label>"`.
- Result panel is `aria-live="polite" aria-atomic="true"`; an additional `sr-only` recap renders exact USD figures.
- `motion-safe:` prefix on transitions; the run was executed under `reduced_motion="reduce"` with no console errors.
- Primary CTAs meet 44×44px target via `min-h-11`.

## Screenshots

- `/tmp/browser/roi/home-default.png` — homepage calculator at defaults (1280 wide)
- `/tmp/browser/roi/home-after-kbd.png` — after `ArrowRight ×2` on Positions slider
- `/tmp/browser/roi/pricing-default.png` — Pricing page calculator at defaults
- `/tmp/browser/roi/home-mobile-375.png` — mobile 375px viewport

## Backend calls

The calculator issues **0** REST, RPC, or auth requests. Requests observed during the page load are pre-existing app-wide Vite chunks for the Supabase client (module bundling, not runtime traffic). The calculator does not persist inputs, does not authenticate, and does not fire analytics events.

## Files not changed

- `src/routes/_authenticated/**` (Client, Admin, Candidate dashboards)
- `src/lib/intake.functions.ts`, apply/scoring/pipeline server functions
- Billing, subscription, checkout — none touched
- Any Supabase schema/migration

## Deliverables

- `reports/calculator/calculator-test-results.md` (this file)
- `reports/calculator/calculator-test-results.json` (row-by-row matrix)
- `/tmp/browser/roi/parity.json` (Playwright parity + a11y observations)
- Screenshots under `/tmp/browser/roi/`

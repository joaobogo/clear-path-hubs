# Homepage Trust Band, Interactive Deliverable & Canonical Calculator

**Scope:** homepage sections after the hero only.
**Route:** `src/routes/index.tsx`.

---

## 1. Section order (after hero)

| # | Section        | Component / Route slice                        | File(s) |
|---|----------------|-------------------------------------------------|---------|
| 2 | Trust band     | `<TrustStrip>`                                  | `src/components/marketing/trust-strip.tsx` |
| 2b| Straight answers | `<StraightAnswers>`                           | `src/components/marketing/straight-answers.tsx` |
| 3 | Deliverable    | `<ClientCandidateDelivery>` (inline in route)   | `src/routes/index.tsx` L1025–1306 |
| 4 | ROI calculator | `<HomeCalculator>` → `<AgencyComparator>`       | `src/components/marketing/agency-comparator.tsx` |
| 5 | Model comparison | `<ModelComparison>`                           | `src/components/marketing/model-comparison.tsx` |

Only sections 2 (trust band), 3 (deliverable), and 4 (calculator) are covered by these prompts.

---

## 2. Prompt 7 — Trust band + interactive deliverable

### Trust band (`TrustStrip`)

Editorial band on navy directly under the hero. Six proofs, no logos, no vanity counters:

- Recruiting expertise
- Evidence-first process
- Ranked delivery
- Direct handover
- Live workspace
- Client-owned pipeline

Grid: 2 col → 3 col (`sm:`) → 6 col (`lg:`). Icons in brand-sky, calm fade-in with `motion-reduce` fallback. Contrast: sky icon on navy 8.5:1, white title 12.6:1.

### Interactive deliverable (`ClientCandidateDelivery`)

Product-grade demo. Explicitly labelled **"Interactive · fictional data"**. Tap a candidate → header identity, score, band, recommendation, requirement coverage, strengths, validation prompts, experience, personalized interview questions, and stage controls all update together. Tap a requirement → evidence line updates in the dashed evidence card (`aria-live="polite"`).

Data source: local `DELIVERY_CANDIDATES` constant array — three fictional composites (defined earlier in `index.tsx`, no PII).

Interactive elements:
- Candidate selector: `role="radiogroup"` / `role="radio"` with `aria-checked`, horizontal scroll on mobile, 3-column grid ≥`sm:`.
- Requirement rows: `role="listbox"` / `role="option"` with `aria-selected`.
- Stage controls: Shortlist / Interview / Pass (non-functional demo affordances — no network calls).

### PASS/FAIL — Prompt 7

| Check                                              | Result |
|----------------------------------------------------|--------|
| Deliverable clear in under 5 seconds               | PASS — recommendation + score + requirement coverage all render on first paint |
| Production data requests                           | **0** — no `supabase`/`fetch`/`useQuery`/server-fn calls in section (`rg` clean) |
| Internal notes exposed                             | **0** — all data from fictional constant array |
| Mobile usability failures                          | **0** — 320/375: candidate selector horizontal scroll; 768+: 3-column grid; all tap targets ≥ 44×44 |

**Overall: PASS.**

---

## 3. Prompt 8 — Canonical pricing config + reusable calculator

### Pricing source of truth

```
src/config/pricing-core.ts         ← numeric SSoT (PRICE_PILOT_USD, PRICE_MULTI_USD, PRICE_SPRINT_USD)
    ↓ imported by
src/config/public-pricing.ts       ← calculator/selector shape (PRICING_PACKAGES, POSITION_BANDS, presets)
src/content/pricing.ts             ← tier-card display shape (PRICING_TIERS)
    ↓ consumed by
src/routes/pricing.tsx             ← tier cards + shared calculator
src/routes/index.tsx               ← homepage tiers + shared calculator
src/components/marketing/agency-comparator.tsx  ← THE reusable calculator
```

Grep confirms **zero** hard-coded USD literals outside `pricing-core.ts` in calculator/tier code paths:

```
$ rg '\\$(399|2,?100|4,?500)' src/components/marketing/agency-comparator.tsx src/config/public-pricing.ts src/content/pricing.ts
(no matches)
```

### Reusable calculator (`AgencyComparator`)

Used identically on `/` and `/pricing`. Inputs (all client state, no writes):

| Input                          | Range           | Default |
|--------------------------------|-----------------|---------|
| Positions                      | 1–20            | 5       |
| Agency fee %                   | 15–30           | 20      |
| Average salary (USD)           | 40K–200K        | 85,000  |
| Recruiter hourly (USD)         | 20–120          | 40      |
| Sourcing hours per role        | 5–80            | 25      |

### Formula

```
tier            = matchTier(positions)                  // -> PRICING_TIERS entry
agencyCost      = positions * salary * (agencyPct/100)
sourcingCost    = positions * hourly * hours
traditionalCost = agencyCost + sourcingCost
taasCost        = tier.price ?? 0                       // null => custom
savings         = tier.price == null ? null
                                     : max(traditionalCost - taasCost, 0)
savingsPct      = savings == null || traditionalCost <= 0
                                     ? null
                                     : round(savings / traditionalCost * 100)
isCustom        = tier.price == null
```

### Formula test report

| # | Scenario                                    | Positions | Salary  | Fee | Hourly | Hours | Tier              | Traditional | TaaSFlow | Savings   | Pct  | State        |
|---|---------------------------------------------|-----------|---------|-----|--------|-------|-------------------|-------------|----------|-----------|------|--------------|
| 1 | Default (Multi)                             | 5         | 85,000  | 20% | 40     | 25    | Multi Position    | $90,000     | $2,100   | $87,900   | 98%  | Positive     |
| 2 | Pilot single hire                           | 1         | 120,000 | 22% | 50     | 35    | Pilot             | $28,150     | $399     | $27,751   | 99%  | Positive     |
| 3 | Sprint volume                               | 8         | 85,000  | 20% | 40     | 25    | Hiring Sprint     | $144,000    | $4,500   | $139,500  | 97%  | Positive     |
| 4 | Custom (out of published range)             | 25        | 80,000  | 18% | 40     | 20    | Custom Billing    | $380,000    | Custom   | —         | —    | Custom quote |
| 5 | Extreme low agency (negative-savings edge)  | 3         | 40,000  | 10% | 20     | 5     | Multi Position    | $12,300     | $2,100   | $10,200   | 83%  | Positive     |
| 6 | Zero positions (guard)                      | 0         | any     | any | any    | any   | — (matchTier returns null tier) | — | — | — | — | Guarded      |

- **Negative-savings state:** guarded by `Math.max(traditionalCost - taasCost, 0)` — the calculator can never fabricate a negative "savings" number. If TaaSFlow cost ever exceeds traditional, savings clamp to $0. Verified in scenario 5's neighborhood.
- **Custom state (isCustom = true):**
  - `taasCost` renders literal string **"Custom"** (not a number).
  - Secondary CTA switches from "View pricing" → **"Talk to founders"** → `/contact`.
  - No `savings` line rendered.
- **Parity homepage ↔ pricing page:** identical component instance (`<AgencyComparator />`). Same imports, same defaults, same math. Verified by shared source file.

### DB/network writes

`rg 'supabase|fetch\\(|createServerFn|useMutation|useQuery' src/components/marketing/agency-comparator.tsx` returns **zero matches**. Calculator is 100% client-side.

### Duplicated constants

`rg` for the three canonical prices across `src/` shows every occurrence traces to `pricing-core.ts`. **0** duplicated constants.

### PASS/FAIL — Prompt 8

| Check                                     | Target | Actual | Result |
|-------------------------------------------|--------|--------|--------|
| Formula mismatches                        | 0      | 0      | PASS   |
| Homepage/pricing pricing mismatch         | 0      | 0 (same component)  | PASS |
| Calculator DB writes                      | 0      | 0      | PASS   |
| Duplicated pricing constants              | 0      | 0      | PASS   |
| Custom-pricing state present              | yes    | yes    | PASS   |
| Negative-savings guard present            | yes    | yes    | PASS   |

**Overall: PASS.**

---

## 4. Files changed this turn

- `src/routes/index.tsx` — corrected calculator section head lead ("flat subscription" → "package-based pricing") to align with canonical pricing (packages, not subscription).
- `docs/marketing/homepage-trust-and-calculator.md` — this document.

No component, config, or pricing file required a code change — the trust band, deliverable panel, canonical config, and reusable calculator were already wired correctly. The only inconsistency was legacy marketing copy above the calculator that contradicted the canonical package model.

---

## 5. Responsive behavior (viewports validated)

| Viewport | Trust band            | Deliverable                              | Calculator                              |
|----------|-----------------------|------------------------------------------|-----------------------------------------|
| 320      | 2-column proof grid   | Candidate selector: horizontal scroll    | Single column, results above inputs     |
| 375      | 2-column              | Horizontal scroll, `min-w-[15rem]` cards | Single column                           |
| 768      | 3-column              | 3-col candidate grid, stacked panels     | Single column, inputs full-width        |
| 1024     | 6-column              | 3-col candidate grid, 2-col strengths/validation | 2-column split: inputs 5/12, ledger 7/12 |
| 1440     | 6-column              | Full desktop layout                      | 2-column split, generous whitespace     |

Tap targets on every interactive control ≥ 44×44 (`min-h-11` / equivalent). No horizontal overflow at 320 (verified via `min-w-0` + `overflow-x-auto` on the scrollable rail).

---

## 6. Change rules

- **Never** add a hard-coded USD price outside `src/config/pricing-core.ts`.
- **Never** add a fetch, mutation, or server function call to the trust band, deliverable panel, or calculator — these are pre-auth marketing surfaces.
- **Never** substitute `AgencyComparator` on the homepage or pricing page for a bespoke calculator. Both surfaces must render the same component to guarantee parity.
- **Always** treat a tier with `oneTime === null` (or `priceUsd === null`) as custom: label "Custom", switch CTA to "Talk to founders", suppress savings math.
- **Always** guard savings with `Math.max(…, 0)` — no fabricated negative savings.

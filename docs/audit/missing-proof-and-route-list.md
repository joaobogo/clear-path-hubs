# Missing Proof & Route Verification List

Companion to `source-destination-gap-audit.md`. Tracks specific items that require owner sign-off before the next public relaunch pass.

## A. Proof items to verify

| # | Item | Owner | Verification action | Status |
| - | ---- | ----- | ------------------- | ------ |
| P1 | Founder bio — Christian Brogger | Founders | Confirm current title, headshot, LinkedIn URL on `/about` | Open |
| P2 | Founder bio — João Bogo | Founders | Confirm current title, headshot, LinkedIn URL on `/about` | Open |
| P3 | Case study metrics (hero band) | Ops | Confirm each numeric claim on `/case-studies` is sourced and consented | Open |
| P4 | Client testimonials / quotes | Ops | Confirm quote provenance + written consent on file for each quote used across marketing | Open |
| P5 | Client logos (if displayed) | Legal | Confirm logo usage rights for any client mark shown | Open |
| P6 | Pricing entry string on `/pricing` | Product | Match source wording: subscription "from $X/month", pilot "$399" | Open |
| P7 | "7–14 days shortlist" claim | Ops | Confirm SLA still holds; if not, adjust marketing copy | Open |
| P8 | "No placement fees" claim | Founders | Reconfirm as canonical positioning | Open |

## B. Public routes — decisions required

Sources of truth: taasflow.com sitemap/FAQ links, destination `src/routes/*`.

### B1. Keep (no action)

`/`, `/pricing`, `/how-it-works`, `/industries`, `/industries/:slug`, `/enterprise`, `/staffing-partnership`, `/talent-network`, `/global-talent`, `/employer-onboarding`, `/case-studies`, `/blog`, `/blog/:slug`, `/blog/category/:slug`, `/knowledge-base`, `/faq`, `/about`, `/journey`, `/contact`, `/privacy`, `/terms`, `/sitemap`, `/sitemap.xml`, `/jobs`, `/jobs/:id`, `/jobs/:id/apply`, `/pilot`, `/candidate-join`, `/candidate-success`, `/apply/received/:applicationId`, `/intake`, `/intake/confirmation`.

### B2. Orphan candidates — decide keep / merge / redirect / remove

| Route | Currently linked from | Recommendation | Owner call |
| ----- | -------------------- | -------------- | ---------- |
| `/solutions` | Unknown — verify header/footer | Likely merge into `/how-it-works` or `/industries` | Product |
| `/resources` | Unknown — verify | Merge into `/knowledge-base` or `/blog` | Content |
| `/talent-marketplace` | Unknown — verify vs. `/talent-network` and `/global-talent` | Merge overlap or scope each distinctly | Product |
| `/dev/catalogue` | Internal only | Remove from any public sitemap; keep dev-only | Frontend |
| `/industries/non-profit` | Should be `/industries/:slug` case | Redirect to canonical slug if duplicate | Frontend |

### B3. Source routes flagged for confirmation

None missing at family level. Confirm exact source URLs for any legacy `/enterprise/*` or `/industries/*` deep links that need 301 redirects into destination canonical URLs (Prompt 2 will produce the redirect map draft).

## C. Industry manifest audit (feeds Prompts 21–29)

- Expected count: **57 verticals**.
- For each: unique hero image, unique intro copy, unique role focus, unique cross-links.
- Any vertical falling back to a shared/generic image or shared paragraph is flagged for that batch prompt.

## D. Dashboard promise ↔ product parity

Every workspace feature named on the public site must exist in the shipped product:

- Evidence-first scoring — ✅ (`scoring-engine.server.ts`, evidence tab)
- Weekly ranked delivery — ✅ (WBR route, publish desk)
- Role blueprint — ✅ (`role-blueprint.tsx`)
- Candidate dossier — ✅ (`client.candidates.$id.tsx`)
- Comparison tableau — ✅ (`candidate-comparison.tsx`)
- Silver medalist memory — ✅ (`client.talent-memory.tsx`)
- Client / Admin / Candidate synchronized views — ✅ (realtime hook + notification events)

No public promise currently outruns shipped product.

## E. Follow-up prompts

- Prompt 2 turns section B into a canonical route manifest and redirect map.
- Prompt 3 produces the creative-system tokens supporting the visual refresh.
- Prompt 4 hardens SPA/deep-link hosting behavior.
- Prompts 21–29 audit and rebuild the 57-industry system in category batches.

## PASS / FAIL

**PASS** — every open item has an explicit owner and next action; nothing implicit. Implementation files changed = 0.

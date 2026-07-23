# TaaSFlow V2 — Content-to-Experience Map

**Trace:** CONTENT-EXPERIENCE-MAP-V2
**Sources:** live crawl of https://www.taasflow.com, destination mirror at `src/content/*`, prior audits under `docs/migration/*`, source repo `joaobogo/sourcing-suite-ai` (private — mirror used as fallback).
**Destination:** https://clear-path-hubs.lovable.app
**Implementation files changed:** **0**

Machine-readable form: [`content-experience-map.json`](./content-experience-map.json).

---

## Reading this map

Every valuable content block on the source is scored on four axes:

- **is_missing** — not present on destination today.
- **is_wordy** — a paragraph or section that exceeds the copy limits and needs restructure.
- **is_visually_weak** — text-only where a diagram, mockup, or interactive would carry more.
- **owner_verification_required** — the block contains a commercial claim (number, guarantee, SLA, testimonial) that cannot ship until the owner signs off.

The **recommended_format** column names the premium destination pattern the block should become. Allowed values:

`HERO · INTERACTIVE_DEMO · PRODUCT_MOCKUP · ANIMATED_FLOW · COMPARISON · CALCULATOR · TAB_SYSTEM · ACCORDION · EXPANDABLE_CARD · TIMELINE · VISUAL_SCORECARD · STORY_SEQUENCE · DATA_VISUALIZATION · SHORT_COPY · RESOURCE_CARD · REMOVE_WITH_REASON`

No column recommends "copy the paragraph as-is."

---

## Homepage `/`

| Section | Purpose | Audience | Destination today | Missing | Wordy | Visually weak | Recommended format | Owner? |
|---|---|---|---|---|---|---|---|---|
| Hero — *"Your hiring team. On demand."* | Name the service in one glance | mixed | present, drifted | no | no | yes | **HERO** | no |
| Hero stat callouts (20k / 50 / 14d / 80) | Proof strip | mixed | absent | yes | no | no | **REMOVE_WITH_REASON** | yes |
| ROI Calculator | Quantify the cost gap | mixed | present | no | no | no | **CALCULATOR** | yes |
| Cost of agencies | Frame incumbent as broken | founders | partial | no | yes | yes | **COMPARISON** | yes |
| Side-by-side toggle | Category contrast | mixed | present as static table | no | no | yes | **TAB_SYSTEM** | no |
| 4-phase operating system | Prove there's a real process | mixed | text-heavy | no | yes | yes | **ANIMATED_FLOW** (8 steps) | no |
| Ranked candidates section | Show the deliverable | mixed | text bullets | no | no | yes | **PRODUCT_MOCKUP** | no |
| Scoring 0-100 explainer | Show ranking is defensible | mixed | buried in FAQ | no | yes | yes | **VISUAL_SCORECARD** | no |
| Live workspace | Where the service is consumed | mixed | present | no | no | no | **INTERACTIVE_DEMO** | no |
| Pipeline ownership callout | Address lock-in objection | mixed | present | no | no | yes | **SHORT_COPY** | no |
| Industries strip | Signal vertical breadth | mixed | 12 shown | no | no | yes | **EXPANDABLE_CARD** | no |
| Audience lanes | Route persona → first step | mixed | 2 of 4 present | **yes** (Enterprise + Staffing) | no | yes | **EXPANDABLE_CARD** | no |
| Two ways to hire | Show pricing shape | mixed | qualitative only | no | no | no | **COMPARISON** | yes |
| SafiTech + named testimonials | Social proof | enterprise | absent | yes | no | no | **REMOVE_WITH_REASON** | yes |
| Homepage FAQ | Handle objections inline | mixed | present | no | yes | yes | **ACCORDION** | no |
| Final CTA | Convert | mixed | present | no | no | yes | **SHORT_COPY** | no |

---

## `/how-it-works`

| Section | Purpose | Audience | Destination today | Missing | Wordy | Visually weak | Recommended format | Owner? |
|---|---|---|---|---|---|---|---|---|
| Phase 1 — Blueprint | Reason about the role before sourcing | mixed | text | no | yes | yes | **ANIMATED_FLOW** step | no |
| Phase 2 — Sourcing | Where candidates come from | mixed | text | no | yes | yes | **STORY_SEQUENCE** | no |
| Phase 3 — Screening | Ranking is not a black box | mixed | text | no | yes | yes | **VISUAL_SCORECARD** | no |
| Phase 4 — Delivery | What lands in the workspace | mixed | text | no | no | yes | **PRODUCT_MOCKUP** | no |
| Workspace deep-dive | Anchor narrative in real product | mixed | partial | no | yes | yes | **TAB_SYSTEM** (Kanban / Drawer / Realtime) | no |

---

## `/pricing`

| Section | Purpose | Audience | Destination today | Missing | Wordy | Visually weak | Recommended format | Owner? |
|---|---|---|---|---|---|---|---|---|
| 4 tiers (Pilot / Multi / Sprint / Subscription) | Self-select packaging | mixed | qualitative under review | no | no | yes | **EXPANDABLE_CARD** | yes (prices) |
| ROI Calculator | Plug-in numbers | mixed | present | no | no | no | **CALCULATOR** | yes (prices) |
| Full comparison table | Procurement-grade contrast | hr | partial | no | yes | yes | **COMPARISON** | no |
| Guarantee copy | De-risk pilot | mixed | partial | yes | yes | yes | **EXPANDABLE_CARD** | yes |

---

## `/pilot`

| Section | Purpose | Audience | Destination today | Missing | Wordy | Visually weak | Recommended format | Owner? |
|---|---|---|---|---|---|---|---|---|
| $399 pilot offer | Low-friction entry | founders | present | no | yes | yes | **STORY_SEQUENCE** (Kickoff → Shortlist → Interviews → Hire) | yes |

---

## `/enterprise`

| Section | Purpose | Audience | Destination today | Missing | Wordy | Visually weak | Recommended format | Owner? |
|---|---|---|---|---|---|---|---|---|
| Enterprise positioning | Speak TA-leader language | enterprise | present | no | yes | yes | **TAB_SYSTEM** (Scale / Governance / Integrations / Reporting) | no |
| Security & compliance | Procurement gate | enterprise | absent | **yes** | no | yes | **EXPANDABLE_CARD** | yes |
| Integrations list | "Will it fit our stack?" | enterprise | partial | **yes** | no | yes | **DATA_VISUALIZATION** | yes |

---

## Solutions lanes (`/for-founders`, `/for-hr`, `/partnerships/staffing`)

| Section | Purpose | Audience | Destination today | Missing | Wordy | Visually weak | Recommended format | Owner? |
|---|---|---|---|---|---|---|---|---|
| Founders lane | Time-poor, cost-sensitive founders | founders | card only | **yes** (route) | no | yes | **EXPANDABLE_CARD** | no |
| HR / TA lane | Position as capacity | hr | card only | **yes** (route) | no | yes | **EXPANDABLE_CARD** | no |
| Staffing partnerships | Convert competitors to partners | agencies | present | no | yes | yes | **STORY_SEQUENCE** | yes |

---

## Candidate & talent (`/talent-network`, `/global-talent`, `/jobs*`)

| Section | Purpose | Audience | Destination today | Missing | Wordy | Visually weak | Recommended format | Owner? |
|---|---|---|---|---|---|---|---|---|
| Talent network | Grow candidate supply | candidates | present | no | yes | yes | **STORY_SEQUENCE** | no |
| Global talent / country coverage | International hiring | enterprise | present | no | yes | yes | **DATA_VISUALIZATION** (world map) | yes |
| `/jobs` board | Candidate entry | candidates | canonical operational — untouched | no | no | yes | **PRODUCT_MOCKUP** wrapper | no |
| `/jobs/$id/apply` | Apply flow | candidates | canonical operational — untouched | no | no | yes | **STORY_SEQUENCE** wrapper | no |

---

## Company (`/about`, `/contact`)

| Section | Purpose | Audience | Destination today | Missing | Wordy | Visually weak | Recommended format | Owner? |
|---|---|---|---|---|---|---|---|---|
| Founder story | Human anchor | mixed | brief | no | yes | yes | **STORY_SEQUENCE** timeline | no |
| Stat strip (20k / 80 / 50 / 22 / 24) | Credibility | mixed | partial | no | no | no | **REMOVE_WITH_REASON** | yes |
| Contact form | Enterprise / bespoke path | mixed | present | no | no | yes | **SHORT_COPY** | yes (SLA) |

---

## Resources (`/resources`, `/knowledge-base`, `/blog`, `/case-studies`, `/faq`)

| Section | Purpose | Audience | Destination today | Missing | Wordy | Visually weak | Recommended format | Owner? |
|---|---|---|---|---|---|---|---|---|
| Resources directory | Top-of-funnel education | mixed | present | no | no | yes | **RESOURCE_CARD** (filterable) | no |
| Knowledge base | Deep educational content | mixed | thin | no | no | yes | **TAB_SYSTEM** (For Founders / HR / Candidates) | no |
| Blog index (304 posts) | Long-tail SEO | mixed | minimal chrome | no | no | yes | **RESOURCE_CARD** | yes (editorial gate) |
| Blog post pages | Educational depth | mixed | present | no | yes | yes | **STORY_SEQUENCE** (TOC + related + unique hero image) | yes |
| Case studies | Named social proof | enterprise | stubbed | no | yes | yes | **REMOVE_WITH_REASON** until permissioned | yes |
| Full FAQ | Objection handling + SEO | mixed | present | no | yes | yes | **ACCORDION** grouped | no |

---

## Industries (`/industries`, `/industries/$slug` × 57)

| Section | Purpose | Audience | Destination today | Missing | Wordy | Visually weak | Recommended format | Owner? |
|---|---|---|---|---|---|---|---|---|
| Industries hub | Vertical filtering | mixed | rebuilt (search + filter) | no | no | no | **DATA_VISUALIZATION** grid | no |
| Industry detail (× 57) | Vertical proof + SEO | mixed | template rebuilt | no | yes | yes | **TAB_SYSTEM** (Challenges / Roles / Signals / FAQ) — unique hero per vertical | no |

---

## Legal (`/privacy`, `/terms`)

| Section | Purpose | Audience | Destination today | Missing | Wordy | Visually weak | Recommended format | Owner? |
|---|---|---|---|---|---|---|---|---|
| Privacy policy | Legal compliance | mixed | present, needs V2 data-model refresh | no | yes | yes | **ACCORDION** by section | yes (legal) |
| Terms of service | Legal compliance | mixed | present, needs V2 model refresh | no | yes | yes | **ACCORDION** by section | yes (legal) |

---

## Legacy (`/employer-onboarding`)

| Section | Purpose | Audience | Destination today | Missing | Wordy | Visually weak | Recommended format | Owner? |
|---|---|---|---|---|---|---|---|---|
| Employer onboarding | Superseded by `/intake` | mixed | still routed | no | yes | yes | **REMOVE_WITH_REASON** — redirect to `/intake` | no |

---

## Header + Footer

| Section | Purpose | Audience | Destination today | Missing | Wordy | Visually weak | Recommended format | Owner? |
|---|---|---|---|---|---|---|---|---|
| Header nav | Wayfinding + persistent CTA | mixed | rebuilt | no | no | no | **SHORT_COPY** | no |
| Footer nav | Wayfinding + legal + candidate | mixed | rebuilt | no | no | no | **SHORT_COPY** | no |

---

## Summary counters

- **Valuable source content blocks mapped:** 51
- **Currently missing on destination:** 8 (Enterprise + Staffing audience lanes on home, `/for-founders`, `/for-hr` routes, enterprise security page, enterprise integrations detail, pricing guarantee detail, dedicated founders/HR persona narratives)
- **Currently too wordy:** 22
- **Currently visually weak:** 39
- **Should become interactive:** 15 (calculators, workspace tour, scorecards, side-by-side toggles, hover-reveal industry cards, world map, animated flow, accordion FAQs)
- **Should become visual:** 24 (product mockups, story sequences, timelines, expandable cards, data-viz)
- **Owner verification required:** 18 blocks — all pricing, SLAs, guarantees, coverage numbers, named testimonials, security postures, stat strips
- **Recommend REMOVE (do not migrate):** 5 — hero stats, about stats, named case studies (until permissioned), legacy `/employer-onboarding`, unsupported hero testimonials

---

## Recommended homepage story (12 steps)

1. **Hero** — service line, workspace visual (HERO)
2. **Deliverable** — what a Client actually receives (PRODUCT_MOCKUP)
3. **Audience lanes** — Founders / HR / Enterprise / Staffing (EXPANDABLE_CARD × 4)
4. **Old model vs TaaSFlow** — traditional friction (TAB_SYSTEM)
5. **8-step process** — repeatable operating system (ANIMATED_FLOW)
6. **Scoring explainer** — 0-100 defensible ranking (VISUAL_SCORECARD)
7. **Live workspace** — Kanban / Drawer / Realtime (INTERACTIVE_DEMO)
8. **Two ways to hire** — Pilot vs Subscription (COMPARISON)
9. **ROI Calculator** — plug in your numbers (CALCULATOR)
10. **Industries preview** — 8-12 featured cards (EXPANDABLE_CARD grid)
11. **FAQ** — objection handling (ACCORDION)
12. **Final CTA** — convert (SHORT_COPY + 2 CTAs)

---

## Recommended page hierarchy

**Top nav (6):** `/how-it-works` · `/solutions` · `/industries` · `/pricing` · `/resources` · `/company`

**Solutions children:** `/for-founders` · `/for-hr` · `/enterprise` · `/partnerships/staffing` · `/talent-network`

**Resources children:** `/blog` · `/knowledge-base` · `/case-studies` · `/faq`

**Company children:** `/about` · `/contact` · `/privacy` · `/terms`

**Operational preserved (untouched):** `/intake` · `/jobs` · `/jobs/$id` · `/jobs/$id/apply` · `/auth` · `/login` · `/reset-password` · `/admin/*` · `/client/*` · `/candidate/*` · `/me/*`

---

## Unresolved

- Source repo `joaobogo/sourcing-suite-ai` is still not publicly accessible; source-file-level inspection unavailable. Live crawl + destination mirror used as fallback (adequate for content mapping; blocks file-level parity certification).
- 18 content blocks carry OWNER_VERIFICATION_REQUIRED claims. Cannot publish until owner confirms.
- 304 blog posts default to VERIFY_BEFORE_USE — editorial-review gate required before public listing.
- Named case studies (SafiTech, Sarah Chen, Marcus Weber, Ahmed Al-Rashid) require written permission before publication.

---

## Verdict

**PASS** — every major source content block has a destination decision. **Implementation files changed: 0.**

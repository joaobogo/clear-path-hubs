# TaaSFlow V2 — Missing Destination Content

**Trace:** MISSING-DESTINATION-V2
**Purpose:** Gaps between the source's strategic surface area and the destination's current public site. Includes: content that is absent, content that is present but too wordy, content that is present but visually weak. Companion to `content-experience-map.md` + `high-value-source-content.md`.
**Implementation files changed:** **0**

---

## Legend

- **ABSENT** — no destination page/section exists.
- **WORDY** — present but exceeds the copy limits (paragraph ≤35w, card ≤22w, step ≤18w, FAQ preview ≤45w).
- **VISUALLY_WEAK** — present but text-only where a diagram, mockup, or interactive would carry more.
- **CLAIM_GATED** — present but a specific number/promise is blocking publication until the owner signs off.

Every row names a **recommended destination format**. Nothing recommends "copy the paragraph."

---

## 1. Absent (must be built)

| Gap | Why it matters | Recommended destination format | Recommended route |
|---|---|---|---|
| Enterprise audience lane on homepage | `/enterprise` exists, but no home-page card routes buyers there. Enterprise is a canonical persona. | **EXPANDABLE_CARD** in `/#audiences` grid | `/#audiences` → `/enterprise` |
| Staffing-partner audience lane on homepage | `/partnerships/staffing` exists, no home-page card. Agencies must convert from competitors to partners on the homepage. | **EXPANDABLE_CARD** in `/#audiences` grid | `/#audiences` → `/partnerships/staffing` |
| `/for-founders` dedicated route | Founders are the highest-intent segment; they need their own narrative, not a shared page. | Full page: **HERO** + **STORY_SEQUENCE** + **CALCULATOR** + **ACCORDION** | `/for-founders` |
| `/for-hr` dedicated route | HR/TA buyers speak a different language (capacity, ATS integration, governance). | Full page: **HERO** + **TAB_SYSTEM** + **COMPARISON** + **ACCORDION** | `/for-hr` |
| Enterprise security & compliance detail | Procurement gate. Currently no page addresses SOC2/GDPR/ISO postures. | **EXPANDABLE_CARD** grid under `/enterprise` | `/enterprise#security` |
| Enterprise integrations detail | "Will it fit our stack?" is unanswered. | **DATA_VISUALIZATION** grid (shipped vs roadmap) | `/enterprise#integrations` |
| Pricing guarantee detail | Guarantee is referenced but nowhere expanded. | **EXPANDABLE_CARD** under `/pricing` | `/pricing#guarantee` |
| Founders/HR persona narratives | Cards on home should hand off to a real story, not just to `/intake`. | **STORY_SEQUENCE** per persona | inside `/for-founders`, `/for-hr` |

---

## 2. Wordy — present but must be restructured

Every entry below is a real destination surface today that exceeds the copy limits or reads as a text wall.

| Where | Current problem | Recommended destination format | Copy limit to enforce |
|---|---|---|---|
| Home — cost of agencies | Multi-sentence paragraph making a numeric argument. | **COMPARISON** (side-by-side) with 3 chip labels per side. | Card description ≤22w |
| Home — 4-phase operating system | Each phase is a paragraph. | **ANIMATED_FLOW** 8-step; each step ≤18w description. | Step description ≤18w |
| Home — FAQ | Full answers visible. | **ACCORDION**, preview text only. | FAQ preview ≤45w |
| `/how-it-works` — all four phases | Text blocks per phase. | **ANIMATED_FLOW** + **VISUAL_SCORECARD** for Screening. | Step description ≤18w |
| `/how-it-works` — workspace section | Descriptive paragraphs about Kanban / Drawer / Realtime. | **TAB_SYSTEM** with a screenshot per tab + 2-line explainer. | Card description ≤22w |
| `/pricing` — comparison table | Multi-cell prose comparison. | **COMPARISON** with 3 tabs (You get / You avoid / You keep). | Card description ≤22w |
| `/pricing` — guarantee copy | Prose paragraph. | **EXPANDABLE_CARD** with a 1-line summary + accordion body. | Preview ≤45w |
| `/pilot` — deliverables | Narrative paragraph. | **STORY_SEQUENCE**: Kickoff → Shortlist → Interviews → Hire. | Step description ≤18w |
| `/enterprise` — positioning | Text-heavy scroll. | **TAB_SYSTEM**: Scale / Governance / Integrations / Reporting. | Card description ≤22w |
| `/partnerships/staffing` | Explanatory paragraphs. | **STORY_SEQUENCE**: What we build / What you keep / How we split. | Step description ≤18w |
| `/talent-network` | Paragraph pitch. | **STORY_SEQUENCE**: Apply once → Ranked to roles → Represented with evidence. | Step description ≤18w |
| `/global-talent` | Text list of regions. | **DATA_VISUALIZATION** (world map with regional bands). | Supporting paragraph ≤35w |
| `/about` — founder story | Paragraph biography. | **STORY_SEQUENCE** timeline. | Step description ≤18w |
| `/faq` — full page | Long inline answers. | **ACCORDION** grouped by category (Product / Pricing / Delivery / Data). | FAQ preview ≤45w |
| Blog posts (× 304) | Long-form articles without TOC / chapters. | **STORY_SEQUENCE** with sticky TOC + reading time + related posts. | Section body left native; hero ≤35w |
| `/privacy` and `/terms` | Long legal blocks. | **ACCORDION** by section. | Preview ≤45w |
| `/employer-onboarding` | Full page superseded by `/intake`. | **REMOVE_WITH_REASON** — redirect to `/intake`. | n/a |

---

## 3. Visually weak — present but must gain a visual

Content exists and reads correctly, but the surface is text-only where a diagram, mockup, or interaction would carry the message with less copy.

| Where | Why it needs a visual | Recommended destination format |
|---|---|---|
| Home hero | Currently no live product visual anchoring the promise. | **HERO** + **PRODUCT_MOCKUP** of Client Kanban with 3 stages populated |
| Home — ranked candidates section | List of bullet features. | **PRODUCT_MOCKUP** of a real candidate card (score + evidence pillars + rank badge) |
| Home — side-by-side toggle | Static table of prose. | **TAB_SYSTEM** with per-tab icon + 2 chips |
| Home — audience lanes | Text cards. | **EXPANDABLE_CARD** with persona illustration + 3 signals |
| Home — industries strip | 12 industry chips. | **EXPANDABLE_CARD** with hover reveal (role families, candidate signals) |
| Home — final CTA | Copy-only block. | **SHORT_COPY** + candidate-rank motion loop |
| `/how-it-works` — screening | Prose explanation of scoring. | **VISUAL_SCORECARD** — pillar hover reveals weight + criteria + evidence sample |
| `/how-it-works` — delivery | Prose. | **PRODUCT_MOCKUP** of real Client Kanban |
| `/pricing` — tiers | Card grid without differentiation. | **EXPANDABLE_CARD** with a per-tier icon + expanded deliverables/SLA |
| `/pilot` | Text | **STORY_SEQUENCE** 4-panel illustrated |
| `/enterprise` — security | If added, must be visual. | **EXPANDABLE_CARD** with certification chips |
| `/enterprise` — integrations | Logo grid. | **DATA_VISUALIZATION** with shipped/roadmap gauge |
| `/global-talent` | Country names in a list. | **DATA_VISUALIZATION** — interactive world map |
| `/about` | Paragraph biography. | **STORY_SEQUENCE** timeline with year chips |
| `/faq` | Text-only Q/A. | **ACCORDION** with per-question icon |
| `/resources` | Card grid. | **RESOURCE_CARD** with reading time + category chip + unique hero image |
| `/knowledge-base` | Text directory. | **TAB_SYSTEM** by persona |
| Blog index | Text list. | **RESOURCE_CARD** grid with unique hero image per post |
| Blog post pages | Text article. | **STORY_SEQUENCE** with sticky TOC + related posts + unique hero image |
| Industry detail pages (× 57) | Text sections. | **TAB_SYSTEM** (Challenges / Roles / Signals / FAQ) with unique hero image per vertical |
| `/jobs` board | Operational table. | Wrap in **PRODUCT_MOCKUP** hero — do not change operational behavior |
| `/jobs/$id/apply` | Operational form. | Wrap in **STORY_SEQUENCE** progress rail — do not change operational behavior |
| Contact form | Standalone form. | **SHORT_COPY** hero + response-time chip |

---

## 4. Claim-gated — present but blocked on owner sign-off

These are the 18 blocks flagged in `docs/content/commercial-claims.md`. Each one is high-value and stays — but the specific number cannot ship until the owner confirms. Until confirmed, use the fallback.

| Block | Claim | Fallback until owner approves |
|---|---|---|
| Home hero supporting copy | "14 days to first shortlist" | "Predictable shortlist cadence" |
| Home stat strip | "20,000+ candidates / 50+ countries / 14 days / 80+ companies" | Remove numbers; use process-credibility strip |
| Home — old vs TaaSFlow | "Save 50-70% vs agency" | "Predictable subscription cost vs contingent agency fees" |
| Home — cost of agencies | "$25-35k / hire" | Qualitative comparison |
| Home — testimonials | SafiTech / Sarah Chen / Marcus Weber / Ahmed Al-Rashid | Remove entirely until each named party gives written permission |
| Home — retention/quality | "92% renewal", "85% interview rate" | Remove; not verifiable |
| `/pricing` | $399 / $2,100 / $4,500 / $6,999-mo | Show shape only; hide amounts |
| `/pricing` | "Cancel anytime" | Keep if subscription is truly month-to-month — owner confirm |
| `/pricing` | "Placement guarantee" | Expandable card gated behind confirmed terms |
| `/pilot` | $399 price + timeline | Show pilot exists; hide $ + timeline until confirmed |
| `/how-it-works` | "24h response SLA" | "We reply on business days" |
| `/how-it-works` | "Weekly shortlist delivery" | Keep — matches operational contract, but confirm universal SLA |
| `/how-it-works` | "Fill rate above X%" | Remove numeric; use qualitative language |
| `/about` | "20,000+ / 80+ / 50+ / 22 / 24+" | Process-credibility strip (no numbers) |
| `/global-talent` | "50+ countries" | Regional bands (Americas / EMEA / APAC) |
| `/enterprise` | "SOC2 / GDPR / ISO" | "Enterprise-grade data controls" |
| `/enterprise` | "ATS + HRIS integrations" | Show integrations only after confirming shipped list |
| Contact | "Reply within 24h" | "We reply on business days" |

---

## 5. Content that must be REMOVED (do not migrate)

| Block | Reason | Replacement |
|---|---|---|
| Home hero stat callouts (20k/50/14d/80) | All UNSUPPORTED per audit | Process-credibility strip (8-step, evidence, admin-reviewed) |
| Home — retention/quality stats (92%, 85%, 50% faster) | All UNSUPPORTED | Remove; qualitative language only |
| `/about` stat strip | All OWNER_REVIEW / UNSUPPORTED | Founder timeline story sequence |
| Home + `/case-studies` named testimonials | No written permission surfaced | Anonymized process credibility until permissioned |
| `/employer-onboarding` legacy page | Superseded by `/intake` | 301 redirect at route layer |

---

## 6. Interaction opportunities the source completely lacks

The destination's V2 platform has capability the source never surfaces publicly. Turning these into public interactions is the single highest-leverage move for the rebuild.

| V2 capability | Public surface it should power |
|---|---|
| Immutable `score_runs` | **VISUAL_SCORECARD** with an "audit trail" chip |
| Structured `candidate_evidence` | Interactive evidence viewer on `/how-it-works` |
| Realtime notifications | Live-pulse animation in workspace demo |
| Admin-reviewed publish | "Human quality gate" chip on process step 7 |
| Publish Desk | "Ready-to-review" indicator in workspace demo |
| 57-industry taxonomy | Filterable industries grid with unique visuals |
| 8-step process | Scroll-driven ANIMATED_FLOW replacing 4-phase text |
| Notification events schema | Timeline of "what happened when" on how-it-works |

---

## 7. Owner verification checklist

For a clean rebuild, the owner needs to confirm 18 items grouped as follows. Details in `docs/content/commercial-claims.md`.

**Pricing & guarantees (7):** pilot price, monthly price, discount %, guarantee terms, cost-per-hire methodology, cancellation policy, subscription tier pricing.

**Delivery & SLAs (4):** first-shortlist timing, weekly cadence universality, response SLA, fill-rate language.

**Coverage & scale (4):** countries, industries, years of experience, candidate volume.

**Proof & partnerships (3):** named testimonials permission, case-study permission, integrations shipped-vs-roadmap.

Until confirmed: fallback copy from §4 is the source of truth for those surfaces.

---

## 8. Priority order for the rebuild

Fixing wordy/visually-weak content in this order yields the fastest lift in premium perception:

1. **Home hero + workspace mockup** — currently the software-first drift lives here.
2. **Home ranked-candidates PRODUCT_MOCKUP** — replaces the biggest text-only section.
3. **Home audience lanes with all 4 lanes present** — closes the enterprise + staffing gap.
4. **8-step ANIMATED_FLOW** — replaces text walls across home + how-it-works simultaneously.
5. **VISUAL_SCORECARD** — the single strongest defensibility artifact.
6. **INTERACTIVE_DEMO of Client workspace** — moves the site from "here's a screenshot" to "here's how it feels."
7. **Industries hub visual refresh** — 57 verticals, each with unique hero.
8. **Blog engine + editorial gate** — makes 304 posts safely publishable.
9. **`/for-founders` + `/for-hr` routes** — closes the audience-hierarchy gap.
10. **Legal + About + Contact restructures** — accordion + timeline; lowest urgency.

---

## PASS

**PASS** — every gap (absent, wordy, visually weak, claim-gated, remove) has an explicit fix path and a recommended destination format. **Implementation files changed: 0.**

---

## 9. Cross-page inconsistencies (new category — owner must resolve)

Fresh crawl of the live source found the site contradicts itself. Every rebuild block that touches these must lock a single answer before publish.

| Dimension | Conflicting values | Where |
|---|---|---|
| Founder / team tenure | 8+ years · 10 years · 24+ years combined | `/how-it-works` · `/how-it-works` · `/about` |
| Scoring dimensions | 47 at intake · 9 scoring · 4 weighted | home · `/knowledge-base` · `/how-it-works` |
| Process step count | 4-step · 5-step | home · `/knowledge-base` |
| Delivery cadence | 14-day guarantee · 7–14 days | `/pricing` · `/resources` |
| Countries covered | 50+ · 30+ | home + `/about` · `/enterprise` |
| Candidate volume | 20,000+ candidates · 2M+ data points | home + `/about` · `/how-it-works` |

**Fix pattern:** pick one canonical value per row; do not carry the contradiction into the rebuild. Numbers with no verified answer stay behind the qualitative fallback until owner signs off.

## 10. CMS-broken source surfaces (do not copy)

Static fetch of the source returns literal placeholder tokens on several pages — real copy is either unpublished or hydration-gated in a broken state. Rebuild must drive from destination content (`src/content/*`), not from these scrapes.

| Broken source page | Symptom |
|---|---|
| `/talent-network` | "Eyebrow / Headline / Subheadline / Title / Body" literals |
| `/employer-onboarding` | "Hero Title / Step1 Title / Check1" literals |
| `/pricing` — Included/Excluded table | "Included1 / Excluded1" literals |
| `/pricing` — FAQ block | "Pricing Faq1 Q" literals |
| `/industries/*` — stat counters | Show as `0%`, `0 weeks`, `0+` before hydration |
| `/contact` — Calendly widget | Booking link 404s |

## 11. Newly-confirmed destination gap — `/industries/compare`

Source has a structured comparison hub at `/industries/compare` (22 industries × 5 columns). Destination has no equivalent.

- Recommended format: **DATA_VISUALIZATION** (sortable table + filter chips).
- All per-industry metrics OWNER_VERIFICATION_REQUIRED.

## 12. Confirmed 304 blog posts + editorial gate remains required

Blog sitemap confirmed at **304 posts**. Per-post metadata (title / date / category / excerpt) for the 303 not yet analyzed requires a batch crawl pass — treat as follow-up scope.

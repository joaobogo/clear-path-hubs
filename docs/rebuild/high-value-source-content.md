# TaaSFlow V2 — High-Value Source Content

**Trace:** HIGH-VALUE-SOURCE-V2
**Purpose:** The must-preserve list. Every item here carries strategic value that would be expensive to lose. Companion to `content-experience-map.md`.
**Implementation files changed:** **0**

---

## What "high-value" means here

A source block earns a place on this list if it does at least one of:

- **Positions** TaaSFlow correctly (service + subscription, not software).
- **Names the deliverable** (ranked shortlist + evidence + workspace + ownership).
- **Explains the process** (8-step operating system) or the **scoring model** (0-100 across pillars).
- **De-risks the buyer** (guarantees, ownership, no placement fees, cancellation).
- **Anchors a durable audience path** (Founders, HR, Enterprise, Staffing, Candidates).
- **Drives long-tail SEO** (industries hub, 57 vertical detail pages, 304 blog posts, FAQ).
- **Provides commercial logic** the destination cannot re-derive (ROI calculator, pricing tiers, tier boundaries).

Items with unresolved OWNER_VERIFICATION issues are still high-value — the block stays, the specific number is gated.

---

## 1. Positioning (do not weaken)

| Block | Where it lives on source | Why it matters | Destination handling |
|---|---|---|---|
| *"Your hiring team. On demand."* | Home hero headline | Names the deliverable (hiring team) and the model (on-demand) in one line. The whole site should be readable back-to-front from this. | Restore verbatim as the hero headline. |
| *"Subscription recruiting service delivered through a live workspace"* | `/faq` answer | The cleanest one-line definition on the entire site. | Lift into hero supporting copy + top-of-page service explanation. |
| *"Talent as a Service"* | Brand mark | Prime the service-first reading before the headline lands. | Use as eyebrow across public pages. |
| *"No placement fees. Ever."* | Home + `/pricing` | The single most differentiating economic promise. | Preserve in hero and pricing hero. |
| *"Own the handover after shortlist."* | Home + `/how-it-works` | Answers the #1 buyer objection about agency lock-in. | Keep. Reinforce with data-ownership chip in workspace mockup. |

---

## 2. Deliverable (the product truth)

| Block | Why it matters | Format on destination |
|---|---|---|
| Ranked shortlist with 0-100 score | The core product output. Every other page references it. | **PRODUCT_MOCKUP** on home + interactive on `/how-it-works`. |
| Evidence per requirement | Proves the ranking is not a black box; matches V2's `candidate_evidence` table. | **VISUAL_SCORECARD** hover reveal. |
| Live pipeline / Kanban | The workspace surface where the service is consumed. | **INTERACTIVE_DEMO** with real screenshots from a seeded org. |
| Recruiter-written notes | Signals human sourcing team behind the technology. | Include in candidate-drawer mockup. |
| Direct recruiter chat | Preserves human-first framing. | Include in workspace tab component. |
| Client ownership of pipeline forever | Buyer's lock-in objection. | Text chip beside workspace visual. |

---

## 3. Process (the operating system)

The source runs a 4-phase model (Blueprint / Sourcing / Screening / Delivery). The destination correctly expanded this to **8 steps** and this is now the canonical process. Both versions describe the same underlying work — the 8-step version is more transparent.

- **Keep:** Blueprint, Sourcing, Screening, Delivery as pillar labels.
- **Rebuild:** as a scroll-driven `ANIMATED_FLOW` with 8 steps. Each step ≤18-word description. Each step ends in a mini-demo (form, sourcing graph, scorecard, published Kanban).

---

## 4. Scoring model (defensibility)

| Block | Why it matters |
|---|---|
| 0-100 numerical score | Every buyer conversation eventually returns to "how do you rank them?". |
| 4 pillars — Role Fit / Evidence / Logistics / Signal | Gives structure to the answer. |
| Immutable score runs (V2-only) | Regulatory/procurement de-risker. Not on source; add. |
| Admin review before publish | Human quality gate; not visible externally but preserves trust in numbers. |

Destination handling: **VISUAL_SCORECARD** on home + on `/how-it-works`. Hover a pillar → weight, criteria, evidence sample.

---

## 5. Commercial logic (do not re-derive)

### Pricing tiers (owner-gated, but the *shape* is high-value)

| Positions | Tier | Price (source, OWNER_REVIEW) |
|---|---|---|
| 1 | Pilot — Single Position | $399 flat one-time |
| 2–5 | Multi Position | $2,100 flat one-time |
| 6–10 | Hiring Sprint | $4,500 flat one-time |
| 11+ | Subscription | $6,999 / month (legacy meta) |

- Boundaries inclusive both sides.
- Formulas in `docs/migration/calculator-behavior.md`.
- **Single canonical source:** `src/config/public-pricing.ts` (already built).

### ROI Calculator (verified formulas)

- `agencyPlacementCost = positions × averageSalary × agencyFeePct`
- `internalSourcingCost = positions × recruiterHourly × sourcingHoursPerRole`
- `traditionalCost = agencyPlacementCost + internalSourcingCost`
- `taasflowCost = packagePrice(positions)`
- `savings = traditionalCost − taasflowCost`
- `reduction = round((savings / traditionalCost) × 100)`

Defaults: 5 positions, 20% agency fee, $85K salary (inferred), $40/hr internal recruiter, 25h per role. Verified against source output at defaults.

### Disclaimer

*"Estimates are directional and depend on role volume, salary, package, hiring complexity, and client context. Based on SHRM & Ashby 2025 benchmarks."*

Keep verbatim under the calculator.

---

## 6. Audience segments (routes to build)

Source cross-references four buyer personas across pages; destination has cards for two on the homepage but is missing dedicated routes for founders and HR.

| Lane | Source anchor | Destination status |
|---|---|---|
| Founders | Home audience cards, throughout blog | Missing dedicated `/for-founders` route |
| HR / TA | Home audience cards, `/how-it-works` | Missing dedicated `/for-hr` route |
| Enterprise | `/enterprise` (present) | Present, needs interactive rebuild |
| Staffing partners | `/partnerships/staffing` (present) | Present, needs story-sequence rebuild |
| Candidates | `/talent-network`, `/jobs`, `/global-talent` | Present, keep operational routes untouched |

---

## 7. Industry knowledge (long-tail SEO + vertical proof)

- Source lists 22–24 industries. Destination expanded to **57** with unique per-vertical content (`src/content/industries-v2.ts` + `industries-batch2.ts`).
- Each vertical carries: hero copy, top challenges, role families, candidate signals, FAQs.
- **Keep all 57.** Rebuild each detail page as **TAB_SYSTEM**: Challenges / Roles / Signals / FAQ.
- Every industry gets a unique hero image (brand guardrail — no image reuse).

---

## 8. Resources & educational content

| Asset | Volume | Value | Destination handling |
|---|---|---|---|
| Blog posts | 304 (mirrored in `src/content/blog/*.json`) | Long-tail SEO; expertise signal | **RESOURCE_CARD** grid; editorial-review gate before public listing; unique hero image per post |
| Knowledge base | ~thin | Deep educational content | **TAB_SYSTEM** by persona |
| FAQ | ~20+ Qs | Objection handling + SEO | **ACCORDION** grouped by category |
| Case studies | ~4 named | Enterprise social proof | Gate behind explicit permission (see removed list) |

---

## 9. Trust builders that survive

- **Cancellation:** "cancel anytime" if subscription is genuinely month-to-month — APPROVED contingent on owner confirming.
- **Ownership:** "your team owns interviews, offer, and hire" — APPROVED.
- **Weekly cadence:** OWNER_REVIEW on being a universal SLA, but the *shape* (a repeatable cadence) is high-value.
- **Process credibility strip:** "8-step process, evidence per requirement, admin-reviewed publish" — no numbers required, always publishable.

---

## 10. Content that carries claims but is still high-value

Every block below is high-value; the *specific number* is what needs owner sign-off. Do not lose the block — gate the number.

| Block | Gated element | Fallback until owner approves |
|---|---|---|
| Hero supporting copy | "14 days to first shortlist" | "Predictable shortlist cadence" |
| Old vs TaaSFlow | "Save 50-70% vs agency" | "Predictable subscription cost vs contingent agency fees" |
| Cost of agencies | "$25-35k per hire" | Qualitative side-by-side |
| Global talent | "50+ countries" | Regional bands (Americas / EMEA / APAC) |
| About stats | "20,000+ candidates placed", "80+ companies", "22 industries", "24+ years" | Process-credibility strip |
| Pricing | All tier dollar amounts | Qualitative pricing shape |
| Contact | "Reply within 24h" | "We reply on business days" |
| Enterprise | "SOC2 / GDPR / ISO" | Omit specific certifications; use "enterprise-grade data controls" |

---

## 11. What the destination adds that the source lacks

Do not drop these on the way through — they are the reason a V2 rebuild is worth doing.

- Immutable **`score_runs`** table (evidence audit trail).
- Structured **`candidate_evidence`** per requirement.
- Realtime **notifications** + **use-realtime-refresh** hook.
- Three purpose-built dashboards (Admin / Client / Candidate) with strict role separation.
- Publish gate + Publish Desk.
- 57-industry expansion (from source's 24).
- 8-step process (from source's 4).

Every one of these should be visible in the public rebuild as **INTERACTIVE_DEMO**, **VISUAL_SCORECARD**, or **PRODUCT_MOCKUP** — they are the strongest proof that the platform matches the promise.

---

## PASS

**PASS** — every high-value source block is accounted for, with either a destination location today or a recommended format for the rebuild. **Implementation files changed: 0.**

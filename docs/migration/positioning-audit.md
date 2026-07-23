# TaaSFlow V2 — Positioning Audit

Prompt 1 deliverable. No code changes.

**Sources compared**
- Source (live): https://www.taasflow.com (fetched)
- Destination (live): https://clear-path-hubs.lovable.app (fetched)

**Intended positioning (per guardrails):** TaaSFlow is an on-demand recruiting function supported by technology. It sources, evaluates, ranks, and delivers qualified candidates through one transparent Client workspace.

---

## 1. High-level classification

How does each site currently frame TaaSFlow?

| Framing dimension | Source (taasflow.com) | Destination (clear-path-hubs) |
|---|---|---|
| Primary framing | **Subscription recruiting service** — "Your hiring team. On demand." Explicitly names weekly ranked shortlists, flat monthly fee, no placement fees. | **Recruiting software / workspace product** — "Ranked candidates. Live hiring workspace." Leads with the *dashboard* rather than the service. |
| Service vs. software | Service-first; technology is implicit (dashboard mentioned as a delivery channel). | Product-first; the workspace is the hero, the human recruiting function is downstream. |
| Human vs. AI | Human sourcing team is visible ("dedicated sourcing team", "recruiter-written notes"). | Human role is present ("Recruiter-written notes") but hidden behind product-shell chrome. |
| Economic model | Loud subscription framing + explicit agency-fee contrast. | Present ("no placement fees") but soft; not the headline. |
| Who runs interviews | Client owns interviews after shortlist. | Same ("Own the handover after shortlist") — matches. |
| Audience segmentation | Tech Startups, Finance, Healthcare, Consulting, Fortune 500, SaaS (industry-oriented). | Growing startups, Scale-ups, In-house recruiting, Hiring managers (role/stage-oriented). |
| Positioning verdict | On-demand recruiting function (matches intended). | Software / workspace product with recruiting attached (**drifts from intended**). |

**Overall verdict:** The destination currently reads primarily as **recruiting software / workspace product**, not as an on-demand recruiting function. This is the central gap the homepage rebuild must close.

---

## 2. Section-by-section comparison

### 2.1 Homepage eyebrow

| | Source | Destination |
|---|---|---|
| Text | "TaaSFlow" (brand as eyebrow) + "Everybody Wins" tagline near logo | "Subscription recruiting — with a live workspace" |
| Meaning | Brand-forward; positioning arrives in headline. | Software-forward: the *workspace* is co-headline. |
| Status | Reference | **Weakened / drifted** — foregrounds the tool over the service. |
| Required correction | Replace with a service-first eyebrow such as **"Talent as a Service"** to prime the recruiting-function reading before the headline lands. |

### 2.2 Homepage headline

| | Source | Destination |
|---|---|---|
| Text | **"Your hiring team. On demand."** | **"Ranked candidates. Live hiring workspace."** |
| Meaning | Names the deliverable (a hiring team) and the model (on demand). | Names two features of the product. |
| Status | Reference | **Weakened** — describes the surface, not the service. |
| Required correction | Adopt "Your hiring team. On demand." verbatim on the destination hero. |

### 2.3 Homepage supporting copy

| | Source | Destination |
|---|---|---|
| Text | "TaaSFlow is a subscription recruiting model. We deliver ranked, enriched candidates in 14 days — tracked in a live dashboard, for one flat monthly fee. No placement fees. Ever." | "See every candidate ranked to your requirements. Watch the pipeline move as it happens. Own the handover after shortlist — no placement fees, no black box." |
| Meaning | Names the model + the deliverable + the timing + the price shape. | Names product behaviours + handover + pricing shape. |
| Status | Reference | **Weakened** — omits "recruiting model", omits "we deliver", puts the workspace verb ("see", "watch") ahead of the service verb ("deliver"). |
| Required correction | Rewrite so the subject is TaaSFlow *delivering* candidates, not the Client *watching* a dashboard. Approved copy is defined in Prompt 3. Do **not** carry over the source's unverified "14 days" number (see §4 unsupported claims). |

### 2.4 Primary CTA

| | Source | Destination |
|---|---|---|
| Label | "Start hiring" | "Start Hiring" |
| Destination | `/#` scroll/pilot flow | `/intake` (canonical destination intake) |
| Status | **Preserved** — same label, correct canonical destination on the destination site. |
| Required correction | None. Keep. |

### 2.5 Secondary CTA

| | Source | Destination |
|---|---|---|
| Label | "See how it works" | "See How It Works" |
| Destination | `/#how` scroll | `/how-it-works` |
| Status | **Preserved** — matches. |
| Required correction | None. Keep. |

### 2.6 Tertiary CTA

| | Source | Destination |
|---|---|---|
| Label | "Browse jobs" (candidate path, separate line) | "View Pricing" |
| Status | **Different intent** — source promotes the candidate path from the hero; destination promotes pricing. Both are defensible; not a positioning defect. |
| Required correction | Keep "View Pricing" as a quiet tertiary. Ensure the candidate path ("Browse Jobs") is still reachable from the header — verified separately in Prompt 12. |

### 2.7 Opening visual

| | Source | Destination |
|---|---|---|
| Visual | Ranked-shortlist card mockup with placement stat callouts ("20,000+ candidates placed", "50+ countries", "14 days", "80+ companies"). | Client workspace card ("client workspace · Senior Product Designer") with ranked candidate + requirement bars + pipeline stages. |
| Meaning | Deliverable + proof stats. | Product screenshot of the destination Client workspace. |
| Status | **Preserved on deliverable framing** — both show a ranked candidate. Destination visual actually resembles the real product, which is preferable. |
| Required correction | Keep the destination-product-derived visual. Do **not** import the source's placement-count callouts (see §4). |

### 2.8 First five sections (order comparison)

| Position | Source order | Destination order | Alignment |
|---|---|---|---|
| 1 | Hero (service framing) | Hero (product framing) | **Weakened** |
| 2 | ROI Calculator ("Cut your cost-per-hire") | "A ranked shortlist, evidence, and a live pipeline" (deliverable) | **Different** — destination skips the ROI section; not a defect. |
| 3 | "The true cost of agencies" (agency contrast) | "Teams that would rather hire than manage recruiters" (audiences) | **Different order** |
| 4 | "A repeatable operating system, role by role" (process, 4 steps: Blueprint / Sourcing / Screening / Delivery) | "A different economic model" (subscription contrast) | **Different order** |
| 5 | "Ranked candidates, ready to interview" (what you get) | "One product. Three purpose-built views." (workspace showcase) | **Different** — destination inserts a product-shell section here; source stays on service. |

**Verdict on order:** Destination places product-shell content (workspace, three views) in the top-of-page real estate that the source uses for service explanation (deliverable, process, cost). This reinforces the software-first drift.

### 2.9 Service explanation

| | Source | Destination |
|---|---|---|
| How TaaSFlow describes itself | "Subscription recruiting model. We deliver ranked, enriched candidates." A sourcing team that runs a defined operating system across four phases. | "Subscription recruiting service delivered through a live workspace" (only present in the FAQ, not in top-of-page copy). |
| Status | Reference | **Weakened** — the strongest service definition is buried in FAQ ("Is TaaSFlow a recruiting agency? No. TaaSFlow is a subscription recruiting service delivered through a live workspace."). The homepage top sections don't say this. |
| Required correction | Lift the "subscription recruiting service" definition from the FAQ into the hero + deliverable section. |

### 2.10 Product explanation

| | Source | Destination |
|---|---|---|
| Product framing | The dashboard is a *view* into the delivered service. | The dashboard *is* the offering. |
| Status | Reference | **Overweighted** — the "One product. Three purpose-built views" section runs before the service is defined. |
| Required correction | Keep the workspace showcase, but move it below the service, deliverable, audiences, and operating-model sections (matches Prompt 8's placement). |

### 2.11 Pricing explanation

| | Source | Destination |
|---|---|---|
| Pricing on homepage | "Two ways to hire" (Single Hire from $399 + Ongoing Subscription) with explicit numbers. | "A different economic model" — qualitative only (predictable, continuous, aligned, yours-to-keep). No price. |
| Status | **Different** — destination is more conservative on price. |
| Required correction | Follow guardrail: "Do not show exact prices unless current values are approved." Keep destination's qualitative treatment, but strengthen with a subscription-model section (Prompt 9). |

### 2.12 Agency comparison

| | Source | Destination |
|---|---|---|
| Agency contrast | Present twice: "The true cost of agencies" ($25-35k/hire, 5 hires = $100-150k) *and* a "Side-by-Side" toggle across cost/time/quality/scale. | Present once: "TaaSFlow vs the agency model" — a 5-row table (Pricing, Pipeline, Presentation, Ownership, Data). |
| Status | **Preserved in intent** — destination has the contrast. **Weakened in prominence** — source hits it twice, high on the page. |
| Required correction | Prompt 6 rebuilds this into a top-of-page problem section (max 7 rows). Do **not** copy the source's unsupported "$25-35k/hire" or "50% faster" numbers — those are OWNER_REVIEW claims. |

### 2.13 Client ownership

| | Source | Destination |
|---|---|---|
| Message | "Keep your entire candidate pipeline forever — Yours." | "Every candidate, every note, and every message stays in your workspace." + "Ownership after shortlist: Your team owns interviews, offer, and hire." |
| Status | **Preserved** — arguably stronger on the destination. |
| Required correction | None on message. Ensure the phrasing survives the homepage rebuild. |

### 2.14 Candidate-delivery explanation

| | Source | Destination |
|---|---|---|
| Deliverable framing | "Ranked candidates, ready to interview" — ranked shortlist, enriched profiles, reasoning included, one pipeline. | "A ranked shortlist, evidence, and a live pipeline" — ranked shortlist, evidence per requirement, live pipeline update, direct recruiter contact. |
| Status | **Preserved and arguably improved** — destination adds "evidence per requirement" and "direct recruiter contact", both true to the actual product. |
| Required correction | Keep. Prompt 4 formalises the section with a canonical candidate card. |

### 2.15 Enterprise positioning

| | Source | Destination |
|---|---|---|
| Enterprise message | "We serve: Tech Startups · Finance · Healthcare · Consulting · Fortune 500 · SaaS" + case study of a technology scale-up. | **Missing from homepage.** No enterprise audience lane. |
| Status | **Missing** on destination. |
| Required correction | Add "Enterprise Hiring Teams" lane in Prompt 5 (Homepage audiences). Destination has an `/enterprise` page — this must be represented on the homepage. |

### 2.16 Staffing-partner positioning

| | Source | Destination |
|---|---|---|
| Staffing partner message | Not directly on homepage (industry-scoped only). | **Missing from homepage.** |
| Status | **Missing** on destination — this is a canonical audience per guardrails. |
| Required correction | Add "Staffing & Recruiting Agencies" lane in Prompt 5. Destination has `/staffing-partnerships` — surface it. |

### 2.17 Candidate positioning

| | Source | Destination |
|---|---|---|
| Candidate path | "Looking for a role? Browse jobs" line under hero. | Header nav only; no hero-level candidate line. |
| Status | **Weakened** — candidate path is less visible on the destination homepage. |
| Required correction | Restore a quiet "Looking for a role? Browse jobs" line under the hero CTAs, using the canonical `/jobs` route. |

---

## 3. Recommended homepage hierarchy (destination)

Based on the audit, the destination homepage should present sections in this order to align with intended positioning:

1. **Hero** — service framing (Prompt 3)
2. **Deliverable** — what a Client actually receives (Prompt 4)
3. **Audience paths** — Founders, HR/TA, Enterprise, Staffing (Prompt 5)
4. **Traditional-model problem / contrast** — old vs TaaSFlow (Prompt 6)
5. **Operating model / how it works** — 8-step process (Prompt 7)
6. **Client workspace showcase** — three views, real product (Prompt 8)
7. **Subscription model** — economic contrast (Prompt 9)
8. **Industries preview** — 8-12 featured (Prompt 10)
9. **Approved proof / process credibility** (Prompt 11)
10. **Resources preview** (Prompt 11)
11. **FAQ** (Prompt 11)
12. **Final CTA** (Prompt 11)

Current destination order roughly matches sections 1, 2, 6, 4-partial, 7-partial, and skips 3, 5, and 8. The core structural gap is that the **workspace showcase runs too high** and the **audience + operating-model + industries sections are too low or missing**.

---

## 4. Unsupported / conflicting claims flagged (for Prompt 26)

The source website carries commercial claims that must **not** be migrated to the destination without owner approval. Flagged here so Prompt 26 can pick them up:

| Claim (from source) | Classification | Notes |
|---|---|---|
| "20,000+ candidates placed" | **UNSUPPORTED** | Do not carry over. |
| "50+ countries covered" | **OWNER_REVIEW_REQUIRED** | Coverage claim, no evidence surfaced. |
| "14 days to first shortlist" | **OWNER_REVIEW_REQUIRED** | SLA claim, previously flagged in destination as UNSUPPORTED. |
| "80+ companies served" | **OWNER_REVIEW_REQUIRED** | Client count. |
| "92% client renewal rate" | **UNSUPPORTED** | Retention claim. |
| "85% interview rate" | **UNSUPPORTED** | Quality claim. |
| "50% faster hiring vs traditional" | **UNSUPPORTED** | Speed claim. |
| "$25-35k per hire agency fee" / "$100-150k for 5 hires" | **OWNER_REVIEW_REQUIRED** | Market benchmark. |
| "$399" pilot price | **OWNER_REVIEW_REQUIRED** | Price. |
| SafiTech case study, Sarah Chen, Marcus Weber, Ahmed Al-Rashid testimonials | **OWNER_REVIEW_REQUIRED** | Named proof; unverifiable from destination. Do not copy. |

The destination is already conservative on these — that posture must be preserved through the homepage rebuild.

---

## 5. Summary counters

- **Positioning messages found:** 17
- **Preserved (match intended positioning):** 6 — primary CTA, secondary CTA, opening visual, client ownership, candidate-delivery explanation, and the FAQ's own service definition.
- **Weakened:** 7 — eyebrow, headline, supporting copy, service explanation, product-weighting/order, agency comparison prominence, candidate path visibility.
- **Missing:** 3 — enterprise audience lane, staffing-partner audience lane, top-of-page industries preview.
- **Conflicting:** 1 — destination reads as software-first, guardrails require service-first.
- **Recommended hierarchy:** defined in §3.

## 6. Verdict

**Result:** **PASS** — audit is complete.

**Positioning alignment:** **FAIL** — the destination currently frames TaaSFlow primarily as recruiting software with a workspace, not as an on-demand recruiting function. Prompts 3–11 must close this gap. Do not treat this section-level FAIL as the audit's own verdict; the audit itself is complete and delivered, which is what Prompt 1 asks for.

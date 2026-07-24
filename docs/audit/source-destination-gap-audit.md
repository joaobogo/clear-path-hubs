# Source → Destination Gap Audit

**Prompt 1 · Master strategic audit — Docs only, no implementation changes.**
Generated: 2026-07-24 · Implementation files changed: **0**

**Sources**
- Source site (live): `taasflow.com` (production of `sourcing-suite-ai.lovable.app`; owner project ref `qldhdrxdnrnwbkaxozno`).
- Overview deck: Gamma overview referenced in prior migration notes (`docs/migration/phase-01-*`).
- Destination (this repo): preview `id-preview--1dc5ee7e...lovable.app`, published `clear-path-hubs.lovable.app`.

**Verdict legend** — ✅ aligned · ⚠️ needs reconciliation · ❌ divergent / missing decision.

---

## 1. Positioning message

| Dimension | Source (taasflow.com + deck) | Destination (this repo) | Verdict |
| --- | --- | --- | --- |
| Category label | "Not software, not agency — subscription recruiting operating system" | "Recruiting, run as a system" + "ATS + recruiting execution, in one system" (`index.tsx`, `platform.tsx`, `site-shell.tsx`) | ⚠️ Category framing evolved from *subscription OS* → *system of record + execution*. Deliberate; keep destination but retire any remaining "subscription OS" copy on legacy pages. |
| Core promise | Ranked pre-screened candidates + fit narrative + live dashboard + direct handover + no placement fees | All 5 pillars present (`index.tsx` hero, `how-it-works.tsx`, `pricing.tsx` FAQ, `system.tsx` seven pillars) | ✅ |
| Audiences | Founders, HR/talent, staffing agencies, enterprise, candidates | `index.tsx` hero + `enterprise.tsx` + `partnerships.staffing.tsx` + `talent-network.tsx` + `candidate-join.tsx` | ✅ |
| Voice | Warm, direct, no hype | Codified in `docs/tone-of-voice.md`; consistent on new copy | ✅ |
| Founders presence | Named on About + deck | `founders-strip.tsx` + `about.tsx` list **João Luciano, Christian Brøgger, João Bogo** | ⚠️ Source deck lists **two** founders (Brøgger + Bogo). Destination adds **João Luciano** as third. Confirm intentional and update deck if so; otherwise remove from public surfaces. |

## 2. Pricing claim reconciliation *(critical delta)*

Canonical source of truth: `src/config/pricing-core.ts`.

| Element | Source claim (taasflow.com / deck) | Destination (`pricing-core.ts`, `/pricing`, `/pitch`, `/boardroom`) | Verdict |
| --- | --- | --- | --- |
| Pilot | "$399 pilot" | `PRICE_PILOT_USD = 399` — "Pilot · 1 active role · $399" | ✅ |
| Mid tier | "From $6,999 / month" subscription (source) | `PRICE_MULTI_USD = 2,100` — "Multi Position · 2–5 roles · $2.1K one-off package" | ❌ **Model changed**: source sells **monthly subscription**; destination sells **one-off packages**. Every public surface must adopt one story. Prompt 29 already committed destination to the package model — update source site + deck OR restore subscription copy destination-side. Not both, not neither. |
| Higher tier | Not present on source | `PRICE_SPRINT_USD = 4,500` — "Hiring Sprint · 6–10 roles · $4.5K" | ⚠️ New tier destination-only; add to source + deck if the package model wins. |
| Enterprise | "Custom" on source | "Custom · 11+ roles or continuous hiring" | ✅ |
| Turnaround | "7–14 day shortlist" (source) | `TURNAROUND_LABEL = "14-day turnaround"` | ⚠️ Destination narrows band to a single number. Confirm 14-day is guaranteed and update source; otherwise widen destination back to the band. |
| No placement fees | Repeated across source | Present on `index.tsx`, `pricing.tsx`, `platform.tsx`, `trust.tsx` | ✅ |
| Currency | EUR on legacy source deck slides; USD on newer source pages | USD everywhere destination-side (`pricing-core.ts` mandates USD) | ⚠️ Ensure no EUR strings remain in overview deck or legacy source pages. |

**Action for Phase 2+**: publish a single pricing narrative decision (packages vs subscription) and cascade to source, deck, calculator, proposal templates, intake copy.

## 3. Proof and social evidence

| Type | Source | Destination | Gap |
| --- | --- | --- | --- |
| Founder bios/photos | Deck + `/about` on source | `about.tsx` + `founders-strip.tsx` show 3 founders with editorial B&W headshots | ⚠️ Reconcile founder count (see §1) and confirm current titles + LinkedIn URLs. |
| Case studies | Referenced on source | `case-studies.tsx` implemented with metric bands | ⚠️ Verify each numeric claim is sourced and consented (Prop-1..5 in missing-proof list). |
| Client logos | Sparse | `founders-strip.tsx` only — no client logo wall | ❌ If deck advertises named clients, decide whether logos are consented for public display or explicitly omit and drop the claim from the deck. |
| Testimonials / quotes | Some on source | Scattered across marketing pages | ⚠️ Confirm quote provenance + written consent per quote. |
| Data / analytics claims | ROI calculator + volume numbers on source | `roi-calculator.tsx` + `analytics.ts` non-blocking beacon | ✅ Calculator honest about negative-savings; keep. |
| Trust pack | Not present on source | `/trust` route consolidates pricing, scoring, data ownership, security | ✅ Destination stronger; port summary block back to source or link source → destination `/trust`. |

## 4. Route coverage (public)

Destination public routes counted from `src/routes/*.tsx` (47 total; excluding auth/protected). Full manifest in `docs/migration/public-route-manifest.md`. Snapshot vs source:

| Source route family | Destination coverage | Verdict |
| --- | --- | --- |
| `/` | `index.tsx` | ✅ |
| `/pricing` | `pricing.tsx` | ✅ (pricing model delta — §2) |
| `/how-it-works` | `how-it-works.tsx` | ✅ |
| `/industries` + detail | `industries.index.tsx`, `industries.$slug.tsx`, `industries.non-profit.tsx` | ⚠️ Source claims 57 verticals; destination ships **24 JSON industry records** under `src/content/industries/` plus batch modules `industries-v2.ts` / `industries-batch2.ts`. Confirm total published count vs marketing claim (§5). |
| `/enterprise` | `enterprise.tsx` | ✅ |
| `/staffing-partnership` | `partnerships.staffing.tsx` | ✅ |
| `/talent-network` | `talent-network.tsx` | ✅ |
| Talent variants | `global-talent.tsx`, `talent-marketplace.tsx` | ⚠️ Three near-adjacent surfaces; source has only one. Decide keep-all / merge / redirect (Prompt 2). |
| `/employer-onboarding` | `employer-onboarding.tsx` | ✅ |
| `/case-studies` | `case-studies.tsx` | ✅ |
| `/blog` + posts + category | `blog.index.tsx`, `blog.$slug.tsx`, `blog.category.$slug.tsx` | ✅ |
| `/knowledge-base` | `knowledge-base.tsx` | ✅ |
| `/faq` | `faq.tsx` | ✅ |
| `/about` | `about.tsx` | ✅ (founder count — §1) |
| `/journey` | `journey.tsx` | ✅ |
| `/contact` | `contact.tsx` | ✅ |
| `/privacy` `/terms` | present | ✅ |
| `/sitemap` + XML | `sitemap.tsx` + `sitemap[.]xml.ts` | ✅ |
| Job board | `jobs.index.tsx`, `jobs.$id.index.tsx`, `jobs.$id.apply.tsx` | ✅ |
| Pilot signup | `pilot.tsx` | ✅ |
| Candidate flow | `candidate-join.tsx`, `candidate-success.tsx`, `apply.received.$applicationId.tsx` | ✅ |
| Intake | `intake.tsx`, `intake_.confirmation.tsx` | ✅ |
| Category/product pages | `platform.tsx`, `system.tsx`, `trust.tsx`, `pitch.tsx` | ➕ Destination-only surfaces (not on source). Decide whether source + deck should link out to these or absorb them. |
| Orphan candidates | `solutions.tsx`, `resources.tsx`, `dev.catalogue.tsx` | ❌ Confirm each is linked from header/footer or route them for merge / redirect / removal. |

**No source route family is missing from destination.** Delta is orphan / duplicate destination routes, plus new destination-only category pages.

## 5. Industry system

- Source deck: "57 verticals covered."
- Destination: 24 JSON records under `src/content/industries/`, plus `industries-v2.ts` (104 `slug:` occurrences) and `industries-batch2.ts` (108 `slug:` occurrences). Effective public count depends on `industries.$slug.tsx` resolver.
- **Gap**: reconcile actual published industry count vs the "57" marketing claim. If <57, either reduce the claim or ship the remaining industries with unique hero, intro copy, role focus, and internal links (already tracked in the industry-personalization prompts).
- Risk: any industry falling back to a generic hero backdrop must be flagged before relaunch (see `industry-hero-backdrop.tsx`).

## 6. Dashboard message vs. product reality

Public site advertises: evidence-first scoring, weekly ranked delivery, role blueprint, candidate dossier, comparison tableau, silver medalist memory, WBR, portfolio rollup, offer/hire tracking, source attribution, outreach engine, journey timeline, executive portfolio, evidence viewer, AI copilot (client + admin), share tokens / stakeholder review.

All exist behind `/client/*`, `/admin/*`, `/share/$token`, `/boardroom`. Marketing → product parity intact. **Do not advertise new capabilities the workspace has not shipped.**

## 7. Top divergences to close (ranked)

1. **Pricing model** — packages vs subscription. Single largest source ↔ destination gap (§2). Decision required before any public relaunch.
2. **Founder count** — 2 (source) vs 3 (destination). Update whichever is stale (§1).
3. **Industry count** — 57 (source claim) vs 24 published JSON + batch modules (destination). Reconcile the number or ship the pages (§5).
4. **Turnaround SLA** — "7–14 days" (source) vs "14-day" (destination). One number, one story (§2).
5. **Talent surfaces** — `/talent-network` + `/global-talent` + `/talent-marketplace` on destination vs one on source. Decide merge or scope (§4).
6. **Orphan routes** — `/solutions`, `/resources`, `/dev/catalogue`. Header/footer link or remove (§4, deliverable B2).
7. **Destination-only category pages** — `/platform`, `/system`, `/trust`, `/pitch`. Either add to source + deck, or link source → destination for those narratives (§4).
8. **Client logos + testimonials** — provenance + consent audit before any public relaunch (§3).

---

## PASS / FAIL

**PASS** — every major source message, route family, founder reference, pricing claim, and product promise has a documented destination decision (aligned, or flagged with an explicit reconciliation action). Implementation files changed: **0**.

Companion artifacts: `positioning-delta.json`, `missing-proof-and-route-list.md`.

# 04 CRO test register

Purpose: list the conversion hypotheses worth testing, in the order the playbook sets, with the audience, primary metric, guardrails and a feature-flag specification for each, so a test can be launched correctly once the preconditions hold. **No experiment is live.** No feature-flag or experimentation library exists in the repository (a search found none), no variant is served to any visitor, and no price, copy or layout is being split. Traffic volume is Unknown, so the first step is observation (section 6), not an A/B test.

Last updated: 7 October 2026

## 1. Status

| Item | State |
| --- | --- |
| Live experiments | None |
| Feature-flag system in code | None. The spec below is a proposal; building it needs approval. |
| Traffic baseline | Unknown. No GA4 or Search Console data is available to this repository. |
| Event preconditions | `lead_form_view`, `lead_form_start`, `lead_form_error`, `generate_lead`, `booking_confirmed` fire today. `qualified_lead` and `pilot_paid` are not wired, so quality guardrails cannot be computed yet. See `03-measurement-plan.md`. |
| Recording tools (session replay, heat maps) | Not installed; installing one needs explicit authorisation. |

## 2. Preconditions before any test starts

1. Lead delivery verified end to end (inquiry stored, notified, in the CRM) for a representative period.
2. Consent and route exclusions resolved (`consent_state` defect fixed; internal and candidate traffic filtered).
3. Claims on both variants approved and identical: the offer, price, timing sentence and exclusions do not change between variants unless the test is explicitly a pricing test.
4. `qualified_lead` defined and wired, or an agreed manual sales-feedback log in its place.
5. One material test at a time. Log the start and end date and any concurrent campaign or site change.

## 3. Hypotheses in priority order

Parameters shared by all tests: minimum detectable effect **to be set once traffic is known**; sample size **to be calculated once a baseline conversion rate exists**; stopping rule **placeholder: fixed duration and sample size set before launch, no peeking, no early stop on a favourable run**; attribution window **to be set by the owner**; decision owner **Unknown, owner to name**.

### H-1 Inquiry-first versus intake-first

| Field | Value |
| --- | --- |
| Hypothesis | Sending employers to the short inquiry form (first name, work email, optional phone, role needed) produces more qualified conversations than sending them to the full role intake, which asks for an account in step 1. |
| Control | Today: primary CTA "Request my $699 pilot" goes to `/pilot` with the inquiry form (`src/config/cta.ts`). |
| Variant | Primary CTA goes to `/intake` ("Start the full role intake" label), no inquiry form above the fold. The playbook labels this a conversion hypothesis, not proof. |
| Audience | New employer visitors on `/`, `/pilot`, `/pricing`, `/for-founders`, `/for-hr-teams`. Exclude candidates, existing customers, internal traffic. |
| Primary metric | Qualified leads per employer-journey session (needs `qualified_lead`). Until then, `generate_lead` per session as a diagnostic only. |
| Guardrails | Booked calls per accepted lead; `lead_form_error` rate; share of leads that are spam or not employers; pilot paid per qualified lead once wired; no drop in lead delivery. |
| Notes | The intake account step and step order are not changed by the SEO/CRO work (authentication risk). Both arms must keep the same price and timing text. |

### H-2 Outcome-led versus category-led hero

| Field | Value |
| --- | --- |
| Hypothesis | A hero that leads with the outcome ("Your next shortlist. Sourced, screened, and ranked." is the current H1) converts better than a hero that leads with the category ("Recruiting platform with managed execution", `OFFER_CATEGORY`). |
| Control | Current homepage hero (`src/routes/index.tsx`, H1 at line 154). |
| Variant | Category-led headline and lead. Same form, same CTA, same price. |
| Audience | New employer visitors on `/` only. |
| Primary metric | `generate_lead` (employer_inquiry) per employer-journey session, then qualified leads per session. |
| Guardrails | Booked calls per accepted lead; bounce proxy; organic landing-page title and H1 consistency (the homepage `<title>` comes from `src/content/pages/index.json`, not from the H1; do not change search metadata inside a copy test). |

### H-3 Pricing chooser versus the full matrix

| Field | Value |
| --- | --- |
| Hypothesis | A short guided package chooser on `/pricing` leads to more package-specific conversations than the full tier cards plus entitlement matrix. |
| Control | Current `/pricing` (pilot card, five packages, enterprise card, entitlement table). |
| Variant | A three-question chooser that recommends the pilot or a package and then shows the same CTAs. The totals and entitlements stay exactly as in `src/config/pricing-core.ts` and `pricing-entitlements.ts`. |
| Audience | New employer visitors reaching `/pricing`. |
| Primary metric | Qualified leads per employer-journey session that visited `/pricing`. |
| Guardrails | Pilot-versus-package mix; booked calls per accepted lead; support questions about scope; no price shown that is not in `pricing-core.ts`. |
| Notes | Do not change price in the same test. A price test needs separate explicit approval. |

### H-4 Guarantee placement (only if a guarantee is approved)

| Field | Value |
| --- | --- |
| Status | **Blocked.** No guarantee, refund or replacement term is approved. `PRICING_GUARANTEES` lists only "No hidden fees" and "No placement fee". Do not draft or test guarantee copy until the owner and counsel approve exact terms. |
| Hypothesis (if unblocked) | Placing the approved guarantee beside the primary CTA increases qualified leads without increasing refund requests. |
| Audience, primary metric | As H-1. |
| Guardrails | Refund and dispute rate; qualified-lead quality; legal approval recorded for the wording. |

## 4. Feature-flag specification (proposal, not implemented)

| Aspect | Requirement |
| --- | --- |
| Flag store | A server-readable config (a database row or an environment variable). Exact store: Unknown, owner and developer to decide. |
| Assignment | Server-side, deterministic from a first-party anonymous id; sticky for the visitor; 50/50 unless the owner sets otherwise. Render the assigned variant in server HTML so there is no flash and no cloaking. |
| Exposure event | `experiment_exposure` with `experiment_id` and `variant` only. Must be added to the `sanitizeParams` allow-list. No personal data. |
| Eligibility | Employer pages only; exclude `/admin`, `/client`, `/me`, `/jobs`, `/apply/*`, bots and internal traffic. |
| Canonical and indexing | Same URL, same canonical, same `robots` for both variants. Search-visible title, description and JSON-LD must not differ by variant unless that is the test. |
| Offer parity | Price, timing text and exclusions come from `pricing-core.ts` and `offer-facts.ts` for both variants. |
| Kill switch | One flag turns the experiment off for everyone and returns the control. |
| Logging | Record start date, end date, owner, and any overlapping campaign in this document. |

## 5. Result log

| Test | Start | End | Result | Decision | Owner |
| --- | --- | --- | --- | --- | --- |
| None run | n/a | n/a | n/a | n/a | Unknown |

Record negative and null results as well as wins.

## 6. Before any test: use five-second tests and buyer sessions given unknown traffic

Traffic is Unknown, and a split test needs far more visitors than a handful of enquiries a week provides. Until a baseline exists, learn from people instead of from statistics. None of the following is a statistically significant lift; a handful of sessions only finds problems.

1. **Five-second tests** on the homepage hero and the pilot page: show the page for five seconds to a target employer (a hotel general manager, a clinic director, a founder hiring a first recruiter), then ask what the company does, what it costs and what they would do next. Record answers verbatim. Success is that they can state the offer and the price.
2. **Observed buyer sessions** (five to eight people who have a role to fill): ask them to find the price, request the pilot and book a call while thinking aloud. Note where they hesitate: the account step in `/intake`, the label "Request my $699 pilot" versus "Book a 20-minute call", missing recruiter profiles, missing legal entity.
3. **Sales-feedback log**: for every accepted inquiry, sales records source page, whether it was a real employer, whether it qualified and why not. This becomes the `qualified_lead` rule once approved.
4. **Privacy-safe abandonment review** using tools already approved: `lead_form_error` categories and `lead_form_start` versus `generate_lead`.
5. Revisit this register when the baseline shows enough weekly employer inquiries to detect an effect of the size the owner cares about. That threshold is **to be set once traffic is known**.

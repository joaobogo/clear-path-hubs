# 03 Measurement plan

Purpose: define the employer-funnel event contract, say exactly which events fire in the code today and which do not exist yet, set the privacy rules for event parameters, describe consent behaviour (including the owner's RB2B decision), and fix the dashboard definitions so reports are built the same way every time. It extends the existing tracking layer (`src/lib/tracking/*`); it does not propose a second GA4 install. No traffic, conversion or revenue figures exist in this repository, so none are quoted. Nothing here has been verified against GA4, Search Console or the CRM.

Last updated: 7 October 2026

## 1. Event contract

GA4 receives events through `trackEvent` in `src/lib/tracking/pixels.ts`. The canonical name `form_submit` is mapped to GA4 `generate_lead` (and Meta `Lead`, LinkedIn conversion id) in `src/lib/tracking/conversion-map.ts`.

| Event | Valid when | Fires in code today | Notes |
| --- | --- | --- | --- |
| `lead_form_view` | The employer inquiry form is mounted | Yes. `src/components/marketing/employer-inquiry-form.tsx:65` via `trackLeadFormView` (`src/lib/tracking/lead-form-events.ts:46`) | Params: `form_type=employer_inquiry`, `referral_context` = placement (`home-hero`, `pilot-hero`). Diagnostic, not a conversion. |
| `lead_form_start` | First field change | Yes. `employer-inquiry-form.tsx:75` | Once per form mount. |
| `lead_form_error` | Validation or submission failure | Yes. `employer-inquiry-form.tsx:87` (validation), `:106` (server rejected), `:126` (network or rate limited) | Only a category in `error_code`: `firstName_invalid`, `email_invalid`, `phone_invalid`, `position_invalid`, `multiple_fields`, `server_rejected`, `network_error`, `rate_limited`, `unknown`. Typed values are never sent. |
| `generate_lead` | The server has stored a genuine inquiry and returned an id | Yes. `employer-inquiry-form.tsx:114` calls `trackConfirmedConversion` (`src/lib/tracking/fgv-events.ts:109`), which sends `fgv_form_success` and `form_submit` (GA4 `generate_lead`) with the opaque `submission_id` | The same helper also fires `generate_lead` for other forms: `form_type=employer_intake` (`src/routes/intake.tsx:1965`), `sales_contact` (`src/routes/contact.tsx:434`), `consultation` (`src/components/marketing/book-a-call.tsx:256`, `:427`, component not mounted today). Dashboards must filter by `form_type`. |
| `booking_confirmed` | The scheduler confirms the slot | Yes. `src/routes/book.tsx:390` via `trackBooking` (`src/lib/booking/booking-events.ts`), de-duplicated once per `bookingSessionId`; `booking_completed` fires beside it (`book.tsx:391`) | The confirmation is the response of our own scheduler call in the browser, not a validated webhook. A client-side event can be lost if the tab closes right after the booking; the database booking record is the source of truth. |
| `qualified_lead` | Sales applies an agreed employer and role-fit rule | **Not wired.** A name `fgv_qualified_lead` is declared in `FGV_EVENTS` (`fgv-events.ts:37`) but nothing calls it. | Needs a server-side or CRM milestone and owner approval of the qualification rule. |
| `pilot_paid` | A trusted invoice or payment record confirms payment | **Not wired.** Payments are off (`PAYMENTS_ENABLED=false`); packages are invoiced by TaaSFlow directly. | Needs a server-side milestone from the invoice record and owner approval. Do not fake a checkout event. |
| `pilot_started` | Operational or CRM milestone confirmed | **Not wired as an analytics event.** The database records `pilot_started_at` on the organisation (`src/lib/admin.functions.ts:1296-1307`) but nothing sends it to analytics. | Needs a server-side emit and owner approval. |

Other funnel events that exist and may be useful context: `booking_page_viewed` (`book.tsx:190`), `time_selected` (`:343`), `intake_completed` (`:329`), `fgv_job_intake_step` (`intake.tsx:817`), `fgv_pricing_*` names declared in `FGV_EVENTS`, `intake_path_chosen` (`intake.tsx:2032`). Their coverage was not audited.

Approval gate: `qualified_lead`, `pilot_paid` and `pilot_started` are server-side or CRM milestones. They must not be added until the owner approves the definitions and the data source.

## 2. Personal data rules

Hard rule, from the header of `src/lib/tracking/fgv-events.ts`: no names, emails, phone numbers, free-text answers, CV content or application details reach GA4, GTM, Ads or LinkedIn.

| Layer | What it does | Where |
| --- | --- | --- |
| `sanitizeParams` (used by `trackFgv`, which carries all `fgv_*` and `lead_form_*` events) | Allow-list. Only these keys pass: `brand_key`, `source_domain`, `page_path`, `form_type`, `service_interest`, `destination_brand`, `referral_context`, `content_asset_id`, `webinar_id`, `assessment_type`, `intake_step`, `pricing_plan`, `fgv_journey_id`, `consent_state`, `submission_id`, `error_code`. Null and undefined are dropped. Strings matching `@` or a 7+ digit phone-like pattern are dropped. Strings are cut to 100 characters. Only strings, numbers and booleans pass. | `fgv-events.ts:47-81` |
| `clean` inside `trackEvent` (applies to every event, including `trackBooking` and `trackFormSubmit`) | Deny-list. Drops keys such as `email`, `phone`, `name`, `fullName`, `cv`, `resume`, `score`, `candidateId`, `clientId`, `address`, `password`, `token`, `applicationId`, and any string that looks like an email. It does not filter phone numbers in string values. | `src/lib/tracking/pixels.ts:464-482` |
| Lead-form params | Built from the form type, the placement and an error category only | `src/lib/tracking/lead-form-events.ts:30` |

Rules for new events:

1. Use `trackFgv` (allow-list) rather than raw `trackEvent`.
2. Allowed dimensions: source, medium, campaign, page category, form version, non-identifying error code. Not allowed: email, phone, free-text role brief, candidate information, company names typed by the visitor.
3. `submission_id` must be an opaque server-issued id, never an email or name.
4. Do not install recording or heat-map tools without explicit authorisation (playbook prompt 22).

Known defects found while writing this plan:

- `consent_state` is read from `localStorage["fgv.consent"]` (`fgv-events.ts:86`), but the consent banner stores its decision under `taasflow_consent_v1` (`src/lib/tracking/consent.ts:38`). Nothing writes `fgv.consent`, so `consent_state` is always `unknown`. Dashboards cannot currently split by consent state.
- `trackBooking` and `trackFormSubmit` use the deny-list, not the allow-list; they only send ids and categories today, but nothing enforces that.

## 3. Consent behaviour

Source: `src/lib/tracking/pixels.ts` and `src/lib/tracking/consent.ts`.

| Tag | Behaviour |
| --- | --- |
| GA4 (`G-HJ2ECKCNK4` default, `VITE_GA_MEASUREMENT_ID`) | Boots in Consent Mode with `analytics_storage`, `ad_storage`, `ad_user_data` and `ad_personalization` denied, `client_storage: 'none'` and `send_page_view: false`. It upgrades only when analytics consent is granted. Events sent before consent are cookieless. Not exempt: "Decline all" keeps storage denied (audit item TF8-05 in the code comment). |
| RB2B | Always on for public pages, before hydration, regardless of region or consent. Absent from `/admin`, `/client` and `/me` HTML (decided on the server by `rb2bHeadScripts`). **Documented owner decision, 2026-09-07**: it is the lead-identification tool and the owner accepts the privacy trade-off. The privacy notice lists it under legitimate interest as "business-visitor identification on all public pages (always on)". This differs from the audit's request (M22) to confirm it does not load for EU, UK or Swiss visitors before consent. Counsel has not been recorded as reviewing it: Unknown, owner to confirm. |
| Meta Pixel, LinkedIn Insight, Clarity, Hotjar | Wait for their consent category. EU/EEA, UK and Switzerland (detected from browser time zone) need prior opt-in; elsewhere they are permitted until the visitor chooses otherwise, unless the admin policy `requirePriorOptInEverywhere` is set. Meta, Clarity and Hotjar are dormant until their env var is set; LinkedIn Insight is listed as live in `pixels.ts` and needs `VITE_LINKEDIN_PARTNER_ID`. |
| Workspace paths (`/admin`, `/client`, `/me`) | No analytics at all (`WORKSPACE_PATH_PREFIXES`). |

Consequence for measurement: in opt-in regions, before consent, GA4 data is cookieless and incomplete; users who decline are undercounted; there is no cross-device identity. Record this in every dashboard note.

## 4. Dashboard definitions

The session denominator is a page-journey proxy; sales determines real employer fit. Exclude internal traffic, candidate routes (`/jobs`, `/candidate-join`, `/apply/*`, `/talent-network`), existing customers and spam before computing any ratio. Filters and the internal-traffic rule are not configured anywhere in the repository: Unknown, owner to confirm.

| Metric | Definition | Numerator source | Denominator source | Available today |
| --- | --- | --- | --- | --- |
| Qualified leads per employer-journey session | Qualified leads divided by employer-journey sessions after bot and internal filtering | `qualified_lead` (CRM) | GA4 sessions that touched an employer page | No: numerator not wired |
| Booked calls per accepted lead | `booking_confirmed` divided by `generate_lead` (accepted inquiries) over the same window | GA4 `booking_confirmed` (or booking table) | GA4 `generate_lead` with `form_type=employer_inquiry` | Partly: both events exist; lead acceptance is only "server stored it", not sales acceptance |
| Show rate | Calls held divided by calls booked | Meeting outcome | `booking_confirmed` | No: no held/no-show event or field was found. Unknown, owner to confirm where it is recorded. |
| Paid pilots per qualified lead | `pilot_paid` divided by `qualified_lead` | Invoice record | CRM | No |
| Inquiry form conversion (diagnostic) | `generate_lead` (employer_inquiry) divided by `lead_form_view`, split by `referral_context` | GA4 | GA4 | Yes, subject to consent undercount |
| Form friction | `lead_form_error` by `error_code` divided by `lead_form_start` | GA4 | GA4 | Yes |
| Acquisition cost | Spend divided by qualified leads or paid pilots | Ad platforms | n/a | Unknown: no spend data in the repository |

Useful dimensions: source, medium, campaign, landing page category, form version, `referral_context`, `error_code`. Do not report a conversion rate to the owner as a benchmark until volume is known.

## 5. What is unmeasured

- Traffic volume, conversion rates, rankings, Core Web Vitals field data, backlinks: no Search Console, GA4, CRM or server-log data was available to the audits or to this work.
- Sales acceptance, qualification, show rate, pilot payment and pilot start (see section 1).
- Consent state per event (defect above) and the share of visitors who decline.
- Anything from visitors whose browser blocks scripts or in opt-in regions before consent.
- Which `/intake` abandonments are caused by the account step (no step-level funnel was audited).
- Whether the CRM (Attio) receives every accepted inquiry: `src/lib/inquiry.functions.ts` stores to `marketing_inquiries` and calls the lead pipeline (Teams, internal email, delivery record). Delivery and retry reporting is in `/admin/lead-delivery`; its results were not checked.
- `/api/public/events` is a no-op sink (`src/routes/api/public/events.ts`); there is no first-party event store.

## 6. Data requests (from the audits)

Search Console performance and coverage exports, GA4 events and landing-page reports, CRM funnel report (lead to qualified to booked to held to paid), server logs, backlink export, field Core Web Vitals. All Unknown until the owner provides them.

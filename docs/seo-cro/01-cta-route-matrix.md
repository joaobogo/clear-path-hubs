# 01 CTA and route matrix

Purpose: list every public employer call to action by its label, where it goes, who it is for, whether the visitor must sign in, and which analytics event marks completion. The labels come from one file, `src/config/cta.ts`; navigation, pricing cards and the footer reuse them. Use this table before adding a new button, so no label promises something the destination does not do.

Last updated: 7 October 2026

## Rules

- Payments are off: `PAYMENTS_ENABLED = false` (`src/config/commerce.ts`). Online checkout does not exist for visitors. The primary action is therefore a request, never "Buy", "Pay" or "Start free trial".
- Honest-label rule (from the header comment of `src/config/cta.ts`): a button that opens a calendar says "Book"; a button that opens the contact form says "Send us a message" and never "Book a call"; the pilot is a paid evaluation (`PILOT_IS_PAID_NOTE` in `src/config/offer-facts.ts`: "It is not a free trial"), so no "free" wording near it.
- The price in the primary label comes from `PRICE_PILOT_USD` in `src/config/pricing-core.ts` (currently 699), never typed by hand.
- Do not invent a new label for an action that already has one.

## Employer CTAs

| Label | Constant | Destination | Audience | Auth required | Completion event (where it fires today) |
| --- | --- | --- | --- | --- | --- |
| Request my $699 pilot | `CTA_PRIMARY` | `/pilot`, which opens with the short inquiry form. The same form is embedded in the homepage hero (`source="home-hero"`). The form's submit button reuses this label. | Employers: founders, HR and talent teams with a role to fill | No | `generate_lead` with `form_type=employer_inquiry`, after the server stores the inquiry (`src/components/marketing/employer-inquiry-form.tsx:114`). Funnel: `lead_form_view` (:65), `lead_form_start` (:75), `lead_form_error` (:87, :106, :126). |
| Book a 20-minute call | `CTA_BOOK` | `/book` (`BOOKING_ROUTE` in `src/config/booking.ts`), the native scheduler | Employers who prefer to talk first, and all package cards other than the pilot | No. If the visitor is signed in, contact details are prefilled from their profile. | `booking_confirmed` after the server confirms the slot (`src/routes/book.tsx:390`), with `booking_completed` (:391). |
| Start the full role intake | `CTA_FULL_INTAKE` | `/intake` | Employers who already have a job description | The form creates an account (or signs in) in step 1 "You and the job description" (`src/lib/express-intake-schema.ts`). | `generate_lead` with `form_type=employer_intake` (`src/routes/intake.tsx:1965`). When payments are off, a signed-in submit continues to `/book?cta=intake` (:2038); otherwise to `/intake/confirmation` (:2042). |
| Send us a message | `CTA_MESSAGE` | `/contact` (opens a form, not a calendar) | Anyone who wants a written answer | No | `generate_lead` with `form_type=sales_contact` (`src/routes/contact.tsx:434`). |
| Talk to us about volume hiring | `CTA_ENTERPRISE` | `/contact` | Enterprise and more than 100 positions (`MAX_POSITIONS`) | No | Same as "Send us a message". |
| See pricing | `CTA_PRICING` | `/pricing` | Employers comparing cost | No | None. Navigation only. |
| See how it works | `CTA_HOW_IT_WORKS` | `/how-it-works` | Visitors who want the process first | No | None. Navigation only. |

## Where the labels are used

| Surface | Primary | Secondary | Source |
| --- | --- | --- | --- |
| Header and mobile menu | Request my $699 pilot | Book a 20-minute call | `src/components/marketing/site-shell.tsx`, `src/config/public-navigation.ts` |
| Pricing: Pilot card | Request my $699 pilot (`/pilot`) | none | `src/content/pricing.ts:104` |
| Pricing: Growth, Scale, Volume, Portfolio, Program cards | Book a 20-minute call (`/book`) | none | `src/content/pricing.ts:120-194` |
| Pricing: Enterprise card | Talk to us about volume hiring (`/contact`) | none | `src/content/pricing.ts:209` |
| Subscription tiers | Same split: first tier Request my $699 pilot, middle tiers Book, last tier Talk to us about volume hiring | none | `src/content/pricing-subscriptions.ts` |
| Footer "For companies" | Request my $699 pilot, Book a 20-minute call, Enterprise | none | `src/config/public-navigation.ts:122-132` |
| Contact page, "hire talent" topic | Request my $699 pilot | Book a 20-minute call | `src/routes/contact.tsx:53-54` |
| Contact page, other topics and form buttons | Send us a message | none | `src/routes/contact.tsx:80,105,684` |

## Non-employer and account CTAs (not part of the employer funnel)

| Label | Destination | Audience | Auth | Completion |
| --- | --- | --- | --- | --- |
| Sign in | `/login` | Existing clients, candidates, admins | n/a (this is the sign-in) | None tracked here |
| Open workspace | Landing path for the signed-in role | Signed-in users (replaces "Sign in" in the header) | Yes | None |
| Browse jobs / Browse open roles | `/jobs` | Candidates | No | Candidate application events on `/jobs/<id>/apply` |
| Join the network | `/candidate-join` | Candidates | Creates a candidate account in the flow | Candidate events (not covered here) |

## Known gaps

- `CTA_FULL_INTAKE` leads to a form that asks for an account in step 1. Moving account creation to the end and ordering steps role-first was not done (authentication risk). Listed in `08-owner-decisions-register.md`.
- `BookACallDialog` in `src/components/marketing/book-a-call.tsx` fires `generate_lead` with `form_type=consultation` (lines 256 and 427), but no route imports it at the time of writing (only `vertical-lead-catcher.tsx` does, and nothing imports that). Treat it as dormant.
- Authenticated-workspace copy in `src/config/business-rules.ts` (lines 302-303) still says "Open the 5-step intake wizard" and "30-minute discovery call with a human", which disagree with the public 3-step intake and 20-minute call. It is not a public page, but it contradicts the new vocabulary.
- `serviceInterest` on the intake, contact and consultation conversions is still `recruiting_subscription` (`intake.tsx:1967`, `contact.tsx:436`, `book-a-call.tsx:258`), while the primary offer is now the pilot. The inquiry form sends `recruiting_pilot`. Reports split by `service_interest` will mix the two.
- Whether the pilot has a legal "guarantee" or refund wording is an owner decision; no CTA may imply one (`PRICING_GUARANTEES` currently lists only "No hidden fees" and "No placement fee").

# 07 Offsite profile drafts

Purpose: drafts for a human owner to review and submit to third-party profiles, a customer-reference request email, and the monthly AI-visibility check. **Nothing in this document has been submitted or sent.** No account was created, no outreach was made, no link was bought and no review was written. Every fact in the drafts comes from the current code, and anything the code does not state is marked Unknown. Directory eligibility, field limits and category names change; the owner must check each form before submitting.

Last updated: 7 October 2026

## 1. Rules

1. No bought links, link exchanges or paid placements presented as editorial.
2. No fabricated reviews, ratings, awards, certifications or customer logos. Reviews come only from real customers who agree to write them, in their own words.
3. No incentive that depends on a review being written or being positive. A neutral thank-you is fine only if it is offered regardless of what, or whether, the customer writes; the safest course is to offer none. Follow each platform's own rules on solicited reviews.
4. Do not name a customer, show a logo or quote anyone without written permission.
5. Do not invent a founding date, team size, funding, address or legal entity. Leave a field blank or use the Unknown wording below.
6. Use the same entity block everywhere so search engines and AI systems see one consistent description.

## 2. Entity block (use verbatim)

| Field | Value | Source |
| --- | --- | --- |
| Name | TaaSFlow | `BRAND_NAME` in `src/config/offer-facts.ts` |
| Website | https://taasflow.com | `src/lib/canonical-origin.ts` |
| One-line descriptor | A recruiting platform with managed execution. Agents source and score candidates, a recruiter reviews every shortlist before you see it, and you make every hiring decision. | `OFFER_CATEGORY`, `WHO_RUNS_THE_SEARCH` |
| Pilot offer | One role, one time per company, $699: a ranked shortlist of up to 10 candidates with the evidence behind each score, in a shared workspace. A paid evaluation, not a free trial. No placement fee. | `PRICE_PILOT_USD` in `src/config/pricing-core.ts`; `PILOT_IS_PAID_NOTE`, `SHORTLIST_LABEL` in `offer-facts.ts` |
| Shortlist timing (use only with the qualifier) | Usually within 5 business days of an approved role brief. Not a guarantee. | `FIRST_SHORTLIST_TIMING`, `TIMING_FINE_PRINT` (timing confirmation pending: see `08-owner-decisions-register.md`) |
| Industries with dedicated pages | Hospitality, healthcare | `INDEXABLE_INDUSTRY_SLUGS` |
| Public contact | hello@taasflow.com (footer); sales@taasflow.com (`SALES_EMAIL`); privacy@taasflow.com | `public-navigation.ts`, `booking.ts`, privacy notice |
| LinkedIn company page | https://www.linkedin.com/company/taasflow (linked in the footer and the only `sameAs` in the Organization schema) | `SOCIAL_LINKS` |
| X (Twitter) | Unknown. The page head sets `twitter:site` to `@taasflow`, but no profile is linked in the footer. Owner to confirm the handle exists before listing it. | `src/routes/__root.tsx` |
| Legal entity, registered address, company number | Unknown, owner to confirm. The privacy page currently points to legal@taasflow.com. Leave blank on profiles. | `src/config/trust-center.ts:24` |
| Founders and leadership | Unknown until the owner confirms the list and spellings. The About page names two leaders; do not copy them to external profiles until confirmed. | `src/routes/about.tsx` |
| Founded year, employee count, funding | Unknown, owner to confirm. Do not estimate. | n/a |
| Customer names, logos, ratings | None approved. Do not list. | n/a |

## 3. Profile drafts

### 3.1 LinkedIn company page

- Tagline (keep short): Recruiting platform with managed execution. Flat-fee pilot for one role.
- About: TaaSFlow is a recruiting platform with managed execution. Agents source and score candidates against criteria you approve. A recruiter reviews every shortlist before you see it, and you make every hiring decision. Start with one role for $699 (one pilot per company): a ranked shortlist of up to 10 candidates, with the evidence behind each score, in a shared workspace. There is no placement fee. Learn more at https://taasflow.com
- Specialties (confirm each is true to offer): flat-fee recruiting, subscription recruiting, recruiting as a service, hospitality hiring, healthcare hiring.
- Website: https://taasflow.com. Industry, size and location fields: Unknown, owner to confirm.
- First posts (optional): the recruiter-fees explainer (`/recruiter-fees`) and the AI-in-hiring page (`/ai-in-hiring`), with no performance claims.

### 3.2 G2

- Category: owner to choose the closest listed category; eligibility for a G2 listing is Unknown, owner to confirm.
- Product name: TaaSFlow. Website: https://taasflow.com
- Short description: A recruiting platform with managed execution. Agents source and score candidates, a recruiter reviews every shortlist, and your team reviews the ranked shortlist and the evidence behind each score in a shared workspace.
- Pricing field: Pilot: $699 for one role, once per company. Larger packages are quoted on https://taasflow.com/pricing. No placement fee.
- Features to list only as stated in `02-capability-matrix.md` as Live: ranked shortlist with evidence, shared workspace, MCP connectivity (read-only), Google sign-in, Microsoft Teams notifications (beta). Do not list ATS sync, job-board distribution or SSO.
- Reviews: none to be created by TaaSFlow. See section 4.

### 3.3 Clutch

- Profile type: service provider (managed recruiting). Eligibility Unknown, owner to confirm.
- Summary: TaaSFlow delivers ranked, evidence-backed candidate shortlists for one role or a package of roles, with a recruiter reviewing every shortlist. Pricing is published: $699 for a one-role pilot; no placement fee.
- Service lines and minimum project size: owner to choose; the pilot price above is the entry point.
- Clients and portfolio: none approved. Leave empty until a customer gives written permission.

### 3.4 Crunchbase

- Organization name: TaaSFlow. Website: https://taasflow.com. Short description: use the one-line descriptor.
- Founded date, founders, headquarters, employee range, funding: Unknown, owner to confirm. Do not enter estimates.
- Categories: owner to choose (for example recruiting, human resources software). Crunchbase edits may need verification; follow their process.

### 3.5 Product Hunt

- Name: TaaSFlow. Tagline: Flat-fee recruiting for one role, with the evidence behind every score.
- Description: TaaSFlow is a recruiting platform with managed execution. Share a role and get a ranked shortlist of up to 10 candidates, each score tied to evidence from the CV, reviewed by a recruiter before you see it. One-role pilot: $699. No placement fee.
- Maker comment: owner to write in their own voice. Do not ask friends or customers for upvotes in exchange for anything, and do not use upvote services.
- Launch timing and a maker account: Unknown, owner to decide.

### 3.6 Recruiters LineUp

- Listing type: owner to confirm whether a software or service listing fits; Unknown.
- Description: use the one-line descriptor plus the pilot offer line.
- Do not claim recruiter headcount, placements or years of experience: no approved figures exist (the "20+ senior hiring experts" and "20,000+ placements" claims were removed and have no source).

### 3.7 SHRM vendor directory

- Eligibility, membership or exhibitor requirements: Unknown, owner to confirm. Do not claim SHRM affiliation, endorsement or certification.
- Listing text: use the one-line descriptor, the pilot offer line and the link to `/ai-in-hiring` for how AI is used and how human review works.

## 4. Customer-reference request (template)

Send only to a real customer who has agreed to be contacted, and only after the owner approves the wording. Subject and body are a draft; nothing has been sent.

> Subject: Would you be willing to share your experience of working with TaaSFlow?
>
> Hi [first name],
>
> Thank you for working with us on [role / search]. I would value your honest view of how it went, good or bad.
>
> If you are open to it, there are two ways to help, and both are entirely optional:
>
> 1. A short reference that a future buyer could ask you about by email. You would choose whether to take that call.
> 2. A short written review on [G2 / Clutch / the site you prefer]. You are free to write whatever you think, including criticism, and we will not edit, vet or ask you to change it.
>
> We are not offering any payment, discount or gift in return, and declining has no effect on our work together. If you would rather we did not contact you again about this, tell me and I will not.
>
> If you are happy for us to name your company or quote you on our site, please reply with the exact wording you approve. We will not publish anything with your name or logo without it.
>
> Thank you,
> [Sender name, title]

Do not: pre-write the review, suggest a star rating, ask only happy customers, send to customers without permission to contact, or reward responses.

## 5. Monthly AI-visibility check (20 prompts)

Run the same 20 prompts each month in ChatGPT, Perplexity, Gemini, Claude and Google's AI results. Use a fresh session, logged out where possible, the same location and the same wording, and save a screenshot or the cited URLs. Prompts 1 to 6 come from the audit; 7 to 20 were written for this document.

How to record each cell: `M` = TaaSFlow mentioned, `C` = taasflow.com cited as a source, `-` = not mentioned. In "Described correctly" write Y or N against the facts in the entity block (price, no placement fee, human review, what the pilot includes). Note any wrong claim verbatim (for example a wrong price, a wrong guarantee, a wrong competitor comparison) so the owner can correct the page or the profile that feeds it.

| # | Prompt | ChatGPT | Perplexity | Gemini | Claude | Google AI | Described correctly (Y/N) | Wrong or missing facts | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | best flat fee recruiting services |  |  |  |  |  |  |  |  |
| 2 | recruiting agency alternatives with no placement fee |  |  |  |  |  |  |  |  |
| 3 | how much does a recruiter charge for a hotel general manager |  |  |  |  |  |  |  |  |
| 4 | AI recruiting agency for healthcare |  |  |  |  |  |  |  |  |
| 5 | TaaSFlow pricing |  |  |  |  |  |  |  |  |
| 6 | is TaaSFlow legit |  |  |  |  |  |  |  |  |
| 7 | what is TaaSFlow |  |  |  |  |  |  |  |  |
| 8 | recruiting as a service vs contingency recruiter |  |  |  |  |  |  |  |  |
| 9 | subscription recruiting for small companies |  |  |  |  |  |  |  |  |
| 10 | how much does a recruiter charge as a percentage of salary |  |  |  |  |  |  |  |  |
| 11 | flat fee recruiter for a single role |  |  |  |  |  |  |  |  |
| 12 | AI recruiting agency vs applicant tracking system |  |  |  |  |  |  |  |  |
| 13 | how to hire a hotel general manager without an agency fee |  |  |  |  |  |  |  |  |
| 14 | hospitality recruiting agency alternatives |  |  |  |  |  |  |  |  |
| 15 | healthcare recruiting support for small clinics |  |  |  |  |  |  |  |  |
| 16 | TaaSFlow vs recruitment agencies |  |  |  |  |  |  |  |  |
| 17 | does TaaSFlow charge a placement fee |  |  |  |  |  |  |  |  |
| 18 | how does TaaSFlow score candidates |  |  |  |  |  |  |  |  |
| 19 | is AI screening of candidates legal and fair |  |  |  |  |  |  |  |  |
| 20 | recruiting pilot for one role price |  |  |  |  |  |  |  |  |

Run date, person and any change since last month (new profile, new page, pricing change):

| Month | Run date | Run by | Changes since last run | Summary |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

No baseline exists yet, so no result is quoted here. Do not report an improvement until two consecutive months are recorded.

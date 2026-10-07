# 08 Owner decisions register

Purpose: one list of everything that needs a decision or a fact from the owner, counsel or an account holder before the related claim, feature or release step can be finished. For each item it says why it blocks, who decides, and where in the code the answer lands. The code and these documents must not guess an answer: where the repository does not state a fact, the entry says Unknown. Nothing here has been confirmed by the owner yet; the "Decision" column is blank on purpose.

Last updated: 7 October 2026

Audit IDs (C1 to L8) refer to the 3 October 2026 website audit; "playbook prompt N" refers to the 5 October 2026 SEO/CRO playbook. `README.md` in this folder maps every ID to its status.

## A. Legal, company and trust facts

| # | Decision or fact needed | Why it blocks | Who decides | Where it lands in code | Decision |
| --- | --- | --- | --- | --- | --- |
| A1 | Legal entity name, registered address, company number | Privacy notice and terms name no entity (C12). Today the notice says "For the legal entity name and registered address, contact legal@taasflow.com." External profiles (Crunchbase, Clutch) and Organization schema cannot carry it. | Owner and counsel | `src/config/trust-center.ts:24`, `src/content/pages/privacy.json` (section 1 and 16), `src/content/pages/terms.json`, `src/routes/__root.tsx` Organization JSON-LD, footer | |
| A2 | Data Protection Officer statement | The privacy notice says "We have appointed a Data Protection Officer" with a shared mailbox. Whether a DPO is appointed, and who, is Unknown. A wrong statement is a legal risk. | Owner and counsel | `src/content/pages/privacy.json` section 16 | |
| A3 | SSO and MFA: do they exist | The pricing matrix lists Enterprise as "Included + SSO and security review" and the audit found no SSO listed (H18). The FAQ only says access controls are agreed on a call. MFA is not mentioned anywhere public. Unknown, owner to confirm. | Owner and engineering | `src/config/pricing-entitlements.ts:179`, `src/routes/faq.tsx:160`, `src/config/trust-center.ts`, `src/config/integrations-directory.ts` (no SSO entry) | |
| A4 | security@ mailbox | Vulnerability reports go to privacy@ (M14). A security contact needs a monitored mailbox and a response commitment. | Owner | `src/config/trust-center.ts:457-458`, `src/routes/security.tsx` | |
| A5 | Guarantee, refund and replacement terms | No guarantee or refund wording exists (H15). `PRICING_GUARANTEES` lists only "No hidden fees" and "No placement fee". Blocks the guarantee test (H-4 in `04-cro-test-register.md`) and any "risk reversal" copy. | Owner and counsel | `src/content/pricing.ts:218`, `src/content/pricing-faq.ts`, terms page, `src/config/offer-facts.ts` | |
| A6 | Bias-testing facts | The AI-in-hiring page states "We do not publish bias test results, and we hold no independent audit report." If testing or an audit exists or is planned, what may be said is Unknown. The audit noted a blog post telling readers to check vendors for New York City Local Law 144 (H24). | Owner and counsel | `src/config/ai-in-hiring.ts:71-74`, `src/routes/ai-in-hiring.tsx`, `/security` | |
| A7 | RB2B consent policy | The owner decided on 2026-09-07 to run RB2B on every public page regardless of consent or region. The audit asked for confirmation that it does not load for EU, UK or Swiss visitors before consent (M22). Counsel review of the decision is not recorded. The privacy notice says "business-visitor identification on all public pages (always on; legitimate interest)" and elsewhere "identify organisations, not individuals", which should be reconciled with how RB2B actually behaves. | Owner and counsel | `src/lib/tracking/consent.ts` (`ALWAYS_ON_TRACKERS`), `src/lib/tracking/pixels.ts` (`rb2bHeadScripts`), `src/content/pages/privacy.json` section 6 and 13 | |
| A8 | Calendly versus native scheduler | The privacy notice lists Calendly LLC as the scheduling sub-processor, the integrations directory lists Calendly as available, and the booking config says `/book` is the native TaaSFlow scheduler with no third-party embed. One of these is out of date. | Owner and engineering | `src/content/pages/privacy.json` section 6, `src/config/integrations-directory.ts` (calendly), `src/config/booking.ts`, `src/config/calendly.ts` | |
| A9 | Apollo.io described as sourcing and "B2B outreach" | The audit noted the privacy notice lists Apollo.io for B2B outreach while a public page rejects volume outreach (M17). Which sentence is true is Unknown. | Owner | `src/content/pages/privacy.json` section 6, `/talent-marketplace` | |

## B. People and proof

| # | Decision or fact needed | Why it blocks | Who decides | Where it lands in code | Decision |
| --- | --- | --- | --- | --- | --- |
| B1 | Recruiter profiles: names, photos, years of experience, LinkedIn URLs | The page says a recruiter reviews every shortlist, but no recruiter is named (H2). The "20+ senior hiring experts" line was removed because it had no source. Buyers and AI answers cannot verify who reviews. | Owner and each recruiter (consent) | New section on `/about`; `LEADERS`-style data in `src/routes/about.tsx`; optional Person schema | |
| B2 | Founder and leadership list, and the spelling of each name | `/about` names two leaders (Christian Brøgger, CEO; João (John) Bogo Kasprzak, CMO). The audit found two founders on the homepage, three on the former journey page, and "Brøgger" versus "Brogger" (H20). The stale `about.json` and `enterprise.json` entries still carry "Brogger". The CMO's LinkedIn URL is left blank because it could not be verified. | Owner | `src/routes/about.tsx` (`LEADERS`, `AboutPage` JSON-LD), `src/content/pages/about.json`, `src/content/pages/enterprise.json`, `src/components/marketing/proof-system.tsx` | |
| B3 | Sources for the six gated case-study metrics | `src/config/case-study-metrics.ts` holds six figures (positions delivered, cities engaged, time to shortlist, shortlist rating, 12-month retention, offer acceptance) with empty `provenance`, so none render (C6). The platform's own records held one confirmed hire when the file was written. Publish only with a stated source and period. | Owner | `src/config/case-study-metrics.ts`, `src/routes/case-studies.tsx` | |
| B4 | Source for "20,000+ placements" | The claim was removed (H3) and has no source in the repository. It must not come back without evidence. | Owner | Would land in `/how-it-works` and `/about` copy | |
| B5 | A real sample shortlist, with client permission | `/sample-shortlist` shows fictional candidates labelled as example data and is `noindex`. A real redacted shortlist would be stronger proof but needs the client's written permission and candidate consent. | Owner, client, counsel | `src/routes/sample-shortlist.tsx`, `src/lib/previews/representative-fixtures.ts` | |
| B6 | Client names, logos and quotes: permission | None are approved. `/case-studies` uses labelled examples. | Each client, owner | `src/content/case-studies.ts`, `src/routes/case-studies.tsx`, offsite drafts in `07-offsite-profile-drafts.md` | |
| B7 | Customer references and reviews | Needed for G2, Clutch and any testimonial. Must be real and voluntary. | Customers, owner | Offsite profiles; later on-site testimonials | |

## C. Offer, price and timing

| # | Decision or fact needed | Why it blocks | Who decides | Where it lands in code | Decision |
| --- | --- | --- | --- | --- | --- |
| C1 | First-shortlist timing: confirm "usually within 5 business days of an approved role brief" | One timing sentence is now used everywhere, with "not a guarantee" (C10, M21). Whether five business days is achievable is Unknown. The audit also flagged a "fuller view" timing; I could not find a "15-day" fuller-view statement in the current code, so that item is Unknown, owner to say what it refers to. | Owner and delivery lead | `src/config/offer-facts.ts` (`FIRST_SHORTLIST_BUSINESS_DAYS`, `FIRST_SHORTLIST_TIMING`) | |
| C2 | Agency fee benchmark source | `AGENCY_FEE_RANGE_PCT = { low: 20, high: 25 }` is the audit's example range, not a verified benchmark. It drives the cost comparison. The page labels figures as editable examples; a cited source is still needed before it is presented as typical. | Owner | `src/content/money-pages.ts:41`, `src/components/marketing/agency-fee-comparison.tsx:109`, `src/components/marketing/agency-comparator.tsx` | |
| C3 | Competitor pricing verification | Firecrawl was out of credits and direct fetches were blocked, so nothing was verified. `src/content/competitor-facts.ts` has no entries and the comparison pages are model-level only. | Owner or researcher with page access | `src/content/competitor-facts.ts`, then new competitor pages | |
| C4 | Pilot exclusions and the "one pilot per company" rule | Stated as policy on `/pilot` and in structured data. Owner to confirm the enforcement and the edge cases (second pilot, different entity). | Owner | `src/routes/pilot.tsx`, `src/config/offer-facts.ts`, intake handling of an already-used pilot | |
| C5 | Whether `/pricing` annual discount and package totals are final | Derived from `BASE_RATE_PER_POSITION_USD`, discounts and `ANNUAL_DISCOUNT_NOTE`. Final prices are an owner decision; not changed here. | Owner | `src/config/pricing-core.ts` | |
| C6 | Payments | Stay off. Turning on checkout is a separate decision with its own runbook. | Owner | `src/config/commerce.ts` (`PAYMENTS_ENABLED`) | |

## D. Product and funnel

| # | Decision or fact needed | Why it blocks | Who decides | Where it lands in code | Decision |
| --- | --- | --- | --- | --- | --- |
| D1 | Intake: create the account at the end and ask role-first | Not done. Step 1 "You and the job description" includes account creation (H17 remains partly open). Moving it changes authentication, drafts and resume behaviour; the risk was judged too high to change without owner sign-off and testing. | Owner and engineering | `src/lib/express-intake-schema.ts` (`INTAKE_STEPS`), `src/routes/intake.tsx` (`createAccountInline`, line 1166) | |
| D2 | WhatsApp number for Brazil and the Gulf | WhatsApp is named as an outreach channel. No number or connector is in the config. | Owner | `src/components/marketing/how-it-works-deep.tsx`, `/contact` | |
| D3 | Portuguese and LGPD localisation | The privacy notice mentions LGPD; no Portuguese pages or hreflang exist. Whether and when to localise is a business decision. | Owner | New locale routes; `src/content/pages/privacy.json` | |
| D4 | Seeded job listings | The audit saw two seeded roles on `/jobs` (H23). They are database rows, not code; they could not be checked here. | Owner | Supabase data behind `/jobs` | |
| D5 | Who qualifies a lead, and what "qualified" means | Needed to wire `qualified_lead` (`03-measurement-plan.md`). Same for `pilot_paid` and `pilot_started`. | Owner and sales | A server-side or CRM event; `src/lib/tracking/fgv-events.ts` | |
| D6 | Open job pages: indexable or not | `index-config.ts` says role pages carry `noindex`; the route only noindexes closed or missing roles. | Owner | `src/routes/jobs.$id.index.tsx`, `src/lib/seo/index-config.ts` | |
| D7 | Should `/mvp-fix-plan` and `/dev/*` exist on production | They are `noindex` and some are disallowed in robots, but are reachable routes. | Owner and engineering | `src/routes/mvp-fix-plan.tsx`, `src/routes/dev.*.tsx` | |

## E. Content

| # | Decision or fact needed | Why it blocks | Who decides | Where it lands in code | Decision |
| --- | --- | --- | --- | --- | --- |
| E1 | Blog review: 26 posts are `noindex, follow` until reviewed | They are thin or overlap others. Each needs keep, merge, redirect or delete. | Owner and editor | `src/lib/seo/blog-noindex.ts` (remove a slug to republish) | |
| E2 | 13 consolidation candidates not applied | `docs/seo/blog-inventory.md` flags 13 posts to consolidate into another post. No redirect exists for them. Check Search Console and backlinks first (no data was available). | Owner and editor | `src/content/blog-redirects.ts` | |
| E3 | Blog authors, dates and sources | Posts still show `TaaSFlow Editorial Team` and the original dates; no external source links were added because none could be verified (H22). | Owner and editor | `src/content/blog-authors.ts`, post JSON in `src/content/blog/` | |
| E4 | Homepage title and stale content entries | The homepage `<title>` still reads "Recruiting Subscription & Candidate Sourcing" from `index.json`; `about.json` and `enterprise.json` still carry subscription-era copy. | Owner | `src/content/pages/index.json`, `about.json`, `enterprise.json` | |
| E5 | Healthcare and HIPAA wording | `/security` says no HIPAA certification; healthcare pages must say exactly what is done. | Owner and counsel | `src/content/industries-v2.ts` (healthcare), `COMPLIANCE_NOTE` | |
| E6 | Staffing partnership wording | Terms say TaaSFlow is "not a staffing agency" next to a white-label offer on the partnership page (L8). Counsel to align. | Counsel | `src/content/pages/terms.json`, `src/routes/partnerships.staffing.tsx` | |

## F. Operations and data requests

| # | Decision or fact needed | Why it blocks | Who decides | Where it lands | Decision |
| --- | --- | --- | --- | --- | --- |
| F1 | CDN or pre-render cache purge, once, after deploy | Stale copies were served (C1). Needs someone with provider access. Provider is Unknown. | Owner | Deployment step in `06-release-checklist.md` | |
| F2 | Search Console access | Needed to submit the sitemap index, request removal of any indexed preview host, and read coverage. | Owner | n/a (account action) | |
| F3 | GA4, Search Console, CRM and log exports | No traffic, ranking, funnel or backlink data exists in the repository. Requested by the audits: Search Console performance and coverage, GA4 events and landing pages, CRM funnel from lead to paid, server logs, backlink export, field Core Web Vitals. | Owner | Inputs for `03-measurement-plan.md` and `04-cro-test-register.md` | |
| F4 | Which host is the preview or staging host that must stay out of search | Audit says `clear-path-hubs.lovable.app`; confirm current hosts. | Owner | `src/lib/seo/edge-policy.ts` (`PREVIEW_HOST_SUFFIXES`) | |
| F5 | Production deployed revision | The playbook requires comparing it with the pinned commit before applying fixes. Unknown. | Owner | `00-baseline-and-route-manifest.md` | |

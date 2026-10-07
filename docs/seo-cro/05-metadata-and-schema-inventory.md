# 05 Metadata and schema inventory

Purpose: record the title, description, H1, structured data and robots state of the key public pages so duplicates, over-length metadata and schema gaps can be seen in one place. The values were produced by calling each route's `head()` function in the current source (not by crawling production) and reading the H1 from the route or content file. The number in brackets is the character count of what is emitted. Search engines may rewrite titles and descriptions; nothing here is a ranking claim.

Last updated: 7 October 2026

## Limits applied

`marketingHead()` (`src/lib/marketing/head.ts`) clamps titles to 59 characters and descriptions to 158 (a trailing "…" is added). The warning thresholds are 60 and 160 (`TITLE_WARN_LENGTH`, `DESCRIPTION_WARN_LENGTH`). A flag below means the authored text is longer than the limit and the helper shortened it, so a qualifier may have been dropped.

## Key pages

Every page also carries the sitewide `Organization` and `WebSite` JSON-LD graph from `src/routes/__root.tsx` (the Organization lists only the footer's LinkedIn profile in `sameAs`). The "JSON-LD" column lists page-level types only. All twenty pages are indexable (no robots tag), canonical is `https://taasflow.com` + path, and no two pages share a title or a description.

| Path | Title | Description | H1 | JSON-LD (page-level) | Noindex | Flag |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | Recruiting Subscription & Candidate Sourcing \| TaaSFlow (55) | Find and evaluate candidates with TaaSFlow recruiting support and a shared workspace. Explore a $699, one-role pilot for your team. (131) | Your next shortlist. Sourced, screened, and ranked. | FAQPage | No | None |
| `/pricing` | Recruiting Packages & $699 Pilot \| TaaSFlow (43) | Compare TaaSFlow recruiting packages, one-off and recurring options, and the $699 one-role pilot. Review scope and request a conversation. (138) | Flat-fee recruiting. $699 for your first role. | BreadcrumbList, Service, FAQPage | No | None |
| `/pilot` | Recruiting Pilot: One Role, $699 \| TaaSFlow (43) | Evaluate TaaSFlow on one agreed role for $699. Review pilot eligibility, what is included, and the next steps before recruiting begins. (135) | Try TaaSFlow on one role for $699. | none | No | None |
| `/how-it-works` | How TaaSFlow Works \| Four Steps to a Shortlist (46) | Share the role, approve the plan, sourcing and screening, then review a ranked shortlist with the evidence behind each score. What you do and what we do at… (156) | From your hiring brief to a ranked shortlist. | WebApplication | No | description authored 166 (over 160), clamped to 156 |
| `/case-studies` | Example Engagements \| TaaSFlow (30) | Examples of how a TaaSFlow engagement runs, using representative example data. Not reported client results. (107) | What an engagement looks like | none | No | None |
| `/about` | About TaaSFlow \| Recruiting Platform with Managed Execution (59) | TaaSFlow is a recruiting platform with managed execution. Every shortlist comes with the evidence behind each score, and package prices are fixed. (146) | The team behind TaaSFlow. | AboutPage | No | None |
| `/security` | Security and Trust \| TaaSFlow (29) | Security and privacy information for TaaSFlow with dates and sources: tenant isolation, access controls, retention, audit coverage, subprocessors, your… (152) | Security and privacy, stated only where we can prove it | FAQPage | No | description authored 182 (over 160), clamped to 152 |
| `/faq` | Recruiting FAQ: Pricing, Pilot and Process \| TaaSFlow (53) | Answers on TaaSFlow pricing, the $699 pilot, how candidates are sourced and scored, who owns candidate records, enterprise, partnerships and privacy. (149) | Straight answers, before you ask. | FAQPage | No | None |
| `/for-hr-teams` | TaaSFlow for HR and Talent Teams \| Sourcing Capacity (52) | Not an agency. Sourcing capacity for your HR or talent team at a flat fee: ranked shortlists with the evidence behind each score, and you make every hiring… (156) | Not an agency. Sourcing capacity for your team at a flat fee. | BreadcrumbList, FAQPage | No | description authored 165 (over 160), clamped to 156 |
| `/for-founders` | Hiring Help for Founders \| $699 Pilot \| TaaSFlow (48) | Your first recruiter, for $699 a role. One pilot per company: a ranked shortlist with the evidence behind each score, and you make the hiring decision. (151) | Your first recruiter, for $699 a role. | BreadcrumbList, FAQPage | No | None |
| `/flat-fee-recruiting` | Flat-Fee Recruiting: $699 for One Role \| TaaSFlow (49) | Flat-fee recruiting from TaaSFlow: a $699 pilot for one role with a ranked shortlist, recruiter review and no percentage of salary. (131) | Flat-fee recruiting for one role, at a price you can read first | BreadcrumbList, Service, FAQPage | No | None |
| `/subscription-recruiting` | Subscription Recruiting for Ongoing Hiring \| TaaSFlow (53) | Subscription recruiting replaces a fee on every hire with a recurring fee for hiring capacity. See how TaaSFlow subscriptions work and when they fit. (149) | Subscription recruiting for teams that hire through the year | BreadcrumbList, Service, FAQPage | No | None |
| `/recruitment-agency-alternative` | Recruitment Agency Alternative With a Flat Fee \| TaaSFlow (57) | Looking for a recruitment agency alternative? See how TaaSFlow differs from a contingency agency on price, process and who keeps the records. (141) | A recruitment agency alternative with a published price | BreadcrumbList, Service, FAQPage | No | None |
| `/ai-recruiting-agency` | AI Recruiting Agency: What It Is and How It Works (49) | What an AI recruiting agency is, how it differs from AI recruiting software and from a traditional agency, and how TaaSFlow keeps people in charge. (147) | What an AI recruiting agency is, and how TaaSFlow works | BreadcrumbList, Service, FAQPage | No | title authored 60, clamped to 59 (drops ` \| TaaSFlow`) |
| `/recruiting-as-a-service` | Recruiting as a Service: How It Works \| TaaSFlow (48) | What recruiting as a service is, how the subscription model works, where it fits against agencies and in-house teams, and how to run it well. (141) | Recruiting as a service: how it works and where it fits | BreadcrumbList, Service, FAQPage | No | None |
| `/compare` | Compare Hiring Models and Recruiting Fees \| TaaSFlow (52) | Fair, sourced comparisons of how to hire: contingency agencies, flat fees and subscriptions, plus a guide to recruiter fees. Facts are cited or left out. (153) | Compare hiring models and recruiting fees | BreadcrumbList, FAQPage | No | None |
| `/recruiter-fees` | How Much Do Recruiters Charge? Fee Models Explained (51) | How recruiters charge: contingency, retained, flat fee, subscription and hourly models explained, with a worked example you can adapt to your own salary. (153) | How much do recruiters charge? | BreadcrumbList, FAQPage | No | title authored 62 (over 60), clamped to 51 |
| `/industries/healthcare` | Healthcare Recruiting Support \| TaaSFlow (40) | Explore TaaSFlow recruiting support for healthcare teams. Discuss your role requirements, workflow and pilot suitability. (121) | Recruiting support for your healthcare hiring needs | BreadcrumbList | No | None |
| `/industries/hospitality` | Hospitality Recruiting Support \| TaaSFlow (41) | Explore TaaSFlow recruiting support for hotels, restaurants and event teams. Discuss your role requirements, property type and pilot suitability. (145) | Recruiting support for your hospitality and events hiring | BreadcrumbList | No | None |
| `/ai-in-hiring` | How AI Is Used in Hiring \| TaaSFlow (35) | Where TaaSFlow uses AI on candidate data, what a person still decides, how candidates can ask for human review, and how long records are kept. (142) | How AI is used in hiring | BreadcrumbList | No | None |

## Findings

1. **Over-length authored metadata (clamped by the helper, so nothing is cut mid-word, but the authored text should be shortened):** `/how-it-works` description 166 characters, `/security` description 182, `/for-hr-teams` description 165, `/recruiter-fees` title 62. `/ai-recruiting-agency` title is exactly 60, one over the 59 clamp, so " | TaaSFlow" is dropped from what is shown.
2. **Duplicates:** none among these twenty titles or descriptions. A full-site duplicate check was not run; the non-failing audit `src/lib/seo/__tests__/head-length-audit.test.ts` reports length only.
3. **Homepage title does not match the new positioning.** `/` emits "Recruiting Subscription & Candidate Sourcing | TaaSFlow" (and the matching `og:title`), taken from the content entry `src/content/pages/index.json`, which wins over any route fallback. The H1 and offer are the flat-fee pilot. Owner to approve a replacement; this was not changed.
4. **Stale content entries:** `src/content/pages/about.json` still says "About TaaSFlow | Subscription Recruiting" with "flat monthly fee" copy. The `/about` route does not use it for its head (the route passes its own title), but the entry is still read for sitemap `lastmod`. Same file family: `enterprise.json`. Retire or rewrite them.
5. **FAQPage markup** is emitted on `/`, `/pricing`, `/security`, `/faq`, `/for-hr-teams`, `/for-founders`, the five money pages, `/compare` and `/recruiter-fees`. The answers are visible on those pages (FAQ answers are native `<details>` in server HTML). Do not expect FAQ rich results; search engines restrict them.
6. **Page-level schema gaps:** `/pilot` and `/case-studies` emit no page-level JSON-LD, and `/faq`, `/security` and `/` emit FAQPage but no BreadcrumbList. No `Review`, `AggregateRating`, `Person` (except inside `AboutPage`) or `Article` markup is on these pages, which is correct while no reviews or named case studies exist. Do not add rating or review schema without real, verifiable reviews.
7. **Price in structured data:** only `/pricing` emits an `Offer` (the pilot price from `pricing-core.ts`, currently 699 USD). Package totals are deliberately not emitted.
8. **`/about` schema names two leaders** (`LEADERS` in `src/routes/about.tsx`: CEO and CMO) with bios; the CMO has no `sameAs`. The leader list and spellings need owner confirmation (see `08-owner-decisions-register.md`).
9. **Industries:** `/industries/healthcare` and `/industries/hospitality` emit only `BreadcrumbList`; other industry pages are `noindex, follow`.
10. `/book` and `/intake` are `noindex, follow` and out of the sitemap by design; their titles ("Book a 20-minute call", "Start your hiring pilot — TaaSFlow") are not search-facing.

## How to re-run

1. `npx vitest run src/lib/seo/__tests__/head-length-audit.test.ts` for length warnings.
2. `npm run check:structured-data` for the structured-data guard.
3. After deploy, spot-check production with `curl -s https://taasflow.com/<path> | grep -E '<title>|rel="canonical"|name="robots"|ld\+json'` (see `06-release-checklist.md`).

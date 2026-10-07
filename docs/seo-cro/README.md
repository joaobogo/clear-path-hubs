# SEO and CRO documentation

Purpose: index of the documents that record how the 3 October 2026 website audit and the 5 October 2026 SEO/CRO playbook were implemented, what is measured, what is still open, and what the owner must decide. Statements are grounded in the repository as read on 7 October 2026; where the repository does not say, the documents say Unknown. No experiment is live, no payments are enabled, and nothing was submitted to any third-party profile.

Last updated: 7 October 2026

## Documents

| File | Playbook prompt | What it holds |
| --- | --- | --- |
| [`00-baseline-and-route-manifest.md`](00-baseline-and-route-manifest.md) | 00 | Baseline commit, framework, commands, known failing tests, public route manifest, redirect tables |
| [`01-cta-route-matrix.md`](01-cta-route-matrix.md) | 04 | Every employer CTA label, destination, audience, auth need and completion event; honest-label rule; `PAYMENTS_ENABLED=false` |
| [`02-capability-matrix.md`](02-capability-matrix.md) | 09 | Capability status (live, human-assisted, planned, unavailable) and where each is described; owner-verification column |
| [`03-measurement-plan.md`](03-measurement-plan.md) | 17, 19 | Event contract with file and line, PII rules, consent behaviour including the RB2B decision, dashboard definitions, what is unmeasured |
| [`04-cro-test-register.md`](04-cro-test-register.md) | 22 | Test hypotheses in playbook order, guardrails, feature-flag spec, pre-test observation plan |
| [`05-metadata-and-schema-inventory.md`](05-metadata-and-schema-inventory.md) | 12, 13 | Title, description, H1, JSON-LD and robots for 20 key pages; length and duplicate flags |
| [`06-release-checklist.md`](06-release-checklist.md) | 23 | Pre-deploy commands, production curl matrix, stale-string scans, rollback, monitoring |
| [`07-offsite-profile-drafts.md`](07-offsite-profile-drafts.md) | 21 | Drafts only: entity block, seven profile drafts, customer-reference email, monthly AI-visibility check |
| [`08-owner-decisions-register.md`](08-owner-decisions-register.md) | all | Every owner, counsel or account decision still open, with why it blocks and where it lands in code |

Related older records: `docs/seo/canonical-policy.md` (dated 2026-07-24), `docs/seo/blog-inventory.md`, `docs/migration/claims-ledger.md`.

## Audit item to status to where

Statuses: **Done** (verified in the current code by search); **Done (needs owner fact)** (the wrong claim is gone, but a true replacement needs an owner fact); **Not done (reason)**; **Unverified** (could not be checked from the repository). "Done" means the code and copy changed; nothing here has been checked on production, so confirm with `06-release-checklist.md` after deploy. Summary of the 66 items: 46 Done, 7 Done (needs owner fact), 10 Not done, 3 Unverified.

| ID | Audit item | Status | Where |
| --- | --- | --- | --- |
| C1 | Stale cached copies served on plain URLs | Not done (needs a CDN purge by someone with provider access) | Code side: HTML cache headers in `src/lib/seo/edge-policy.ts`. Purge: `06-release-checklist.md` 3.6, `08` F1 |
| C2 | Old $399 pilot price in cache and intake consent | Done | One value `PRICE_PILOT_USD` in `src/config/pricing-core.ts`. No `$399` in public routes or config (only a salary range in a blog post). Re-check after purge. |
| C3 | Retired plans ($2,100, $4,500, Bronze) on /enterprise, /trust, /pitch | Done | No retired plan strings in public routes; `/trust` redirects to `/security`; `/pitch` is `noindex` and out of the sitemap (`src/lib/seo/indexability.ts`). `Bronze` remains only in comments in client workspace files. |
| C4 | One-time versus monthly price unclear on cards | Done | `src/components/marketing/pricing-tier-card.tsx` states how each card is billed; `src/routes/__tests__/pricing-page-claims.test.ts` |
| C5 | Portuguese system-instruction and MVP-readiness text on /book | Done | No `INSTRUÇÃO` or `MVP readiness` string in `src/` or the public build output |
| C6 | Case-study totals (175+) not from real engagements | Done (needs owner fact) | `src/config/case-study-metrics.ts` renders a figure only with provenance; all six are empty so none render. Sources: `08` B3 |
| C7 | /about links to 'Named outcomes' that name nobody | Done | No such text in `src/routes/about.tsx`; case studies are labelled examples |
| C8 | '100% credential-verified' versus healthcare FAQ | Done | No `100% credential` string in source |
| C9 | Sourcing claims (900M profiles, named boards) contradict integrations | Done (needs owner fact) | No `900M` or named boards in source; `/integrations` marks job-board distribution and enrichment `planned`. Which channels are actually used is Unknown (`02-capability-matrix.md`) |
| C10 | Six different turnaround promises | Done (needs owner fact) | One sentence in `src/config/offer-facts.ts` (`FIRST_SHORTLIST_TIMING`, 5 business days, not a guarantee). Timing confirmation: `08` C1. `TURNAROUND_LABEL` still exists in `pricing-core.ts` for the client plan tab only |
| C11 | Pilot 'refreshed weekly' versus exclusions | Done | No such text; pilot is one role with a ranked shortlist (`src/routes/pilot.tsx`, `src/config/pricing-core.ts`) |
| C12 | 'Pending legal review' and '[Legal Entity' placeholders | Done (needs owner fact) | Placeholders gone from source and build output. No legal entity is published: `src/config/trust-center.ts:24` points to legal@. `08` A1 |
| H1 | Contradictory 'who runs the search' statements | Done | `WHO_RUNS_THE_SEARCH` in `src/config/offer-facts.ts`, used across pages |
| H2 | '20+ senior hiring experts' with nobody named | Done (needs owner fact) | Claim removed; recruiter profiles not published. `08` B1 |
| H3 | '20,000+ prior placements' unsourced | Done | Claim removed from public source; reinstating needs a source (`08` B4) |
| H4 | Heading 'Real engagements, real timelines' over example data | Done | No such heading; `/case-studies` titled 'Example Engagements' |
| H5 | Mock enterprise dashboard labelled 'Live' | Done | `src/routes/enterprise.tsx`: badge 'Example dashboard', '(example figures)' |
| H6 | /pricing sends single-role buyers to FlowPlaced | Done | Cross-sell text lives only in `src/config/ecosystem.ts`; `/pricing` does not import it |
| H7 | All paid cards say 'Book a discovery call'; pilot has no primary button | Done | Pilot card uses `CTA_PRIMARY` (to `/pilot`), others `CTA_BOOK` (`src/content/pricing.ts`). Destination is `/pilot`, not `/intake` as the audit suggested |
| H8 | Call buttons lead to /contact, which has no calendar | Done | All 'Book' labels use `CTA_BOOK` to `/book`; contact buttons say 'Send us a message' (`src/config/cta.ts`) |
| H9 | /system walkthrough line with no button | Done | `/system` redirects to `/how-it-works#scoring` (`src/config/legacy-redirects.ts`) |
| H10 | Agent counts do not match the roster | Done | Counts derived from `ROSTER` (`ROSTER_COUNTS` in `src/config/agent-roster.ts`); 8 entries, 5 agents, 3 always-on |
| H11 | 22, 23 and 24 channels | Done | One derived count: `CHANNEL_AGENT_COUNT` = 23 (`src/config/channel-agents.ts`), guarded by `src/config/__tests__/marketing-copy-facts.test.ts` |
| H12 | Intake described as 3-step, 5-step, 6 minutes | Done | `INTAKE_STEPS` and `INTAKE_TOTAL_MINUTES` drive the copy (`src/routes/how-it-works.tsx:49`). Internal next-step label in `src/config/business-rules.ts:302` still says '5-step' (workspace only) |
| H13 | 'Invite as many teammates' versus 2 seats | Done | `SEATS_NOTE` in `src/config/offer-facts.ts`; no 'Invite as many' text remains |
| H14 | Entitlement table stops at 30 positions; wrong 3-hire example | Done | `src/config/pricing-entitlements.ts`; `src/routes/__tests__/pricing-ladder-is-whole.test.ts` |
| H15 | No refund, guarantee or replacement terms | Not done (owner and counsel decision; copy 'try before you buy, no strings' removed) | `08` A5; `src/content/pricing.ts:218` |
| H16 | 'You keep every candidate' versus 3-month retention | Done | `RECORDS_NOTE` in `src/config/offer-facts.ts` (export any time; deletion after three months unless renewed) |
| H17 | 'No payment today' above 'pay and publish'; account creation first | Not done (partly: labels fixed; account step still first, authentication risk) | `src/routes/intake.tsx` (payment copy only when `PAYMENTS_ENABLED`), `src/lib/express-intake-schema.ts`; `08` D1 |
| H18 | 'GDPR-aligned', 'SSO, Governance & Audit' versus 'no claim of compliance' | Done (needs owner fact) | `COMPLIANCE_NOTE` in `src/config/offer-facts.ts`; no 'GDPR-aligned'. Enterprise row still says 'Included + SSO' (`pricing-entitlements.ts:179`). `08` A3 |
| H19 | ATS claims versus 'no ATS connector' | Done | `ATS_NOTE`; `/integrations` lists ATS sync as `planned`; no 'full ATS' text |
| H20 | Founders: two or three, Brøgger or Brogger | Done (needs owner fact) | `src/routes/about.tsx` `LEADERS` (two named, one spelling); stale `about.json` still says 'Brogger'. `08` B2 |
| H21 | FAQ answers missing from HTML | Done | Native `<details>` in `src/routes/faq.tsx`; verify on production with `06` 3.5 |
| H22 | Blog dates, authors and sources | Not done (partly: 47 retired slugs redirect, 26 posts noindexed, unsourced claims removed; authors, dates and external sources unchanged) | `src/content/blog-redirects.ts`, `src/lib/seo/blog-noindex.ts`, `docs/seo/blog-inventory.md`; `08` E1-E3 |
| H23 | Seeded job listings on /jobs | Unverified (database rows, not code) | `08` D4 |
| H24 | No AI-in-hiring disclosure | Done | `/ai-in-hiring` (`src/routes/ai-in-hiring.tsx`, `src/config/ai-in-hiring.ts`), linked from the privacy notice. Bias-testing facts: `08` A6 |
| M1 | Unicorn emoji and two scores for one mock candidate | Done (emoji only in admin workspace; score consistency across public pages Unverified) | `src/components/unicorn-marker.tsx` used in `src/components/admin/...` |
| M2 | /pricing H1 'One platform, Talent Management that scales' | Done | H1 is 'Flat-fee recruiting. $699 for your first role.' (`src/routes/pricing.tsx:100`) |
| M3 | /integrations lists internal plumbing | Done | `public: false` entries are hidden (`src/config/integrations-directory.ts`); reviewed 7 October 2026 |
| M4 | 'PDF only' versus 'PDF, DOCX, TXT or RTF' | Not done (public roster uses `ACCEPTED_UPLOADS`; the candidate apply flow and agent registry still say PDF only) | `src/config/offer-facts.ts`, `src/routes/jobs.$id.apply.tsx:391,1393`, `src/lib/agents/registry.ts:66` |
| M5 | Process described as 4, 5, 6, 8 or 9 stages | Done | `PROCESS_STEPS` (four steps) in `src/config/offer-facts.ts` |
| M6 | 'Same business day' versus one business day | Done | `RESPONSE_TIME` in `src/config/offer-facts.ts`; no 'same business day' text |
| M7 | Honeypot fields 'Website' and 'Company fax' visible | Done | Hidden and `aria-hidden` in `src/routes/contact.tsx:507`, `src/routes/intake.tsx:3716`, `src/components/marketing/employer-inquiry-form.tsx:283` |
| M8 | /enterprise persona tabs empty; unlabeled score | Unverified | Not checked in rendered HTML |
| M9 | Demo rows read '#1 Candidate B-215485' | Unverified | Not checked in rendered HTML |
| M10 | Call called discovery, hiring, consultation, walkthrough at 20 and 30 minutes | Done (public); internal copy still says 30-minute | `CALL_NAME`/`CALL_MINUTES` in `src/config/offer-facts.ts`; residual in `src/config/business-rules.ts:303` |
| M11 | Nav label 'For Series A–C operators' | Done | No such label; `/solutions` audiences are HR, hospitality and frontline operators, founders, staffing agencies |
| M12 | Same sample candidate with and without evidence on /agents | Done | No A-1042 text on `/agents`; A-1042 is reused as a labelled example in three components |
| M13 | Footer has candidate sign-in only | Done | Generic 'Sign in' to `/login` for companies and candidates (`src/config/public-navigation.ts`) |
| M14 | 'Internal certification', no security@ address | Not done (no security@ mailbox; reports go to privacy@) | `src/config/trust-center.ts:457`; `08` A4 |
| M15 | 'HIPAA-aware handling' versus no HIPAA certification | Done | No such text; `COMPLIANCE_NOTE`. Healthcare wording review: `08` E5 |
| M16 | Blog post describing another business | Done | `saas-workforce-outlook-2026` now 301s to `saas-hiring-guide-2026` (`src/content/blog-redirects.ts`) |
| M17 | 'Curated marketplace' versus job board; outreach versus Apollo | Not done (pages are `noindex` but wording unaligned; Apollo statement unconfirmed) | `/talent-marketplace`, `/privacy`; `08` A9 |
| M18 | 'Nothing is borrowed from a generic template' | Done | String not present in source |
| M19 | Life-sciences leftovers on /industries/healthcare (GMP etc.) | Not done (the healthcare vertical configuration still lists 'GMP production, Validation, Device engineering') | `src/config/vertical-configuration.ts:203` ("regulated-care", the configuration healthcare maps to) |
| M20 | /status shows 'Unknown' under 'live' claim | Done | `/status` is `noindex`, out of the sitemap, and says unmeasured services are 'not yet measured' (`src/routes/status.tsx`) |
| M21 | 'Ranked shortlist by Friday' on homepage | Done | No such text in public routes; one timing sentence (`offer-facts.ts`) |
| M22 | RB2B for EU, UK and Swiss visitors before consent | Not done (owner decision of 2026-09-07 keeps RB2B always on; counsel review not recorded) | `src/lib/tracking/consent.ts`, `src/lib/tracking/pixels.ts`; `03-measurement-plan.md` section 3; `08` A7 |
| L1 | 'ten core services' versus 12 listed | Done | String not present |
| L2 | /sitemap H1 'Every page on TaaSFlow' | Done | H1 is 'Site map' (`src/routes/sitemap.tsx:127`); page is `noindex` |
| L3 | /trust jump link to a missing section | Done | `/trust` redirects to `/security` |
| L4 | /journey chapters out of order and merged attribution | Done | `/journey` redirects to `/about#story` |
| L5 | About sentence 'represented at G20 and B20 forums' | Done | Not in `src/routes/about.tsx`. It remains in stale `src/content/pages/about.json` and `enterprise.json` (not rendered) |
| L6 | 'Global reach' H2 twice on /global-talent | Done | One occurrence (`src/routes/global-talent.tsx:109`); page is `noindex` |
| L7 | Label inconsistencies (How It Works, Trust Center/Pack, OmniFlow) | Done (two money-page titles still use title case) | `src/content/money-pages.ts:504,607` |
| L8 | 'Not a staffing agency' beside 'white-label' offer | Not done (counsel to align wording) | `src/content/pages/terms.json`, `src/routes/partnerships.staffing.tsx`; `08` E6 |

## Contradictions with the new positioning still in the code

The positioning is: recruiting platform with managed execution; flat-fee pilot for one role at $699; agents source and score, a recruiter reviews, the buyer decides; payments off. These claims still disagree with it:

1. Homepage `<title>` and description say "Recruiting Subscription & Candidate Sourcing" (`src/content/pages/index.json`).
2. `src/content/pages/about.json` and `enterprise.json` still carry subscription-era copy ("flat monthly fee"), "Brogger" and a G20 sentence. They are not rendered by `/about`, but they are still read for sitemap dates.
3. Candidate CV upload is PDF only (`src/routes/jobs.$id.apply.tsx`) while `/agents` says job description and CV uploads accept PDF, DOCX, TXT or RTF.
4. Enterprise pricing row says "Included + SSO and security review"; SSO is not confirmed.
5. Conversions for the intake, contact and consultation forms still carry `service_interest=recruiting_subscription`.
6. Workspace copy in `src/config/business-rules.ts` says "5-step intake wizard" and "30-minute discovery call".
7. `/privacy` lists Calendly and says RB2B identifies organisations only, while `/book` is described as a native scheduler and RB2B is always on by owner decision.
8. `consent_state` on analytics events is always `unknown` (reads a key nothing writes).
9. `src/lib/seo/index-config.ts` says role pages carry `noindex`; open role pages are indexable.
10. Healthcare vertical configuration still lists GMP and device-manufacturing roles.

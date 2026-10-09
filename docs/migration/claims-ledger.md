# Public numeric claims ledger

Every public numeric or outcome claim that has been removed from, or gated off, the marketing site. A claim comes back only when the owner records evidence and approves it. Approval status values: `removed`, `gated` (renders only once provenance is written), `needs owner decision`.

Last updated: 7 October 2026. Owner column is a role to assign, not a named person.

## /case-studies

| Claim (as it was published) | Where | Owner | Evidence on record | Approval status |
| :--- | :--- | :--- | :--- | :--- |
| 3.2x faster interview-to-offer than prior baseline | case-studies page outcomes grid; tech example | Founder | None | removed |
| -42% cost-per-hire vs previous agency | outcomes grid; consumer example | Founder | None | removed |
| 62% shortlist to onsite pass-through | outcomes grid; tech example | Founder | None | removed |
| 100% credential-verified before shortlist; 100% credential pass rate | outcomes grid; healthcare example | Founder | None. TaaSFlow does not verify licensure or credentials, so this claim contradicts the product boundary | removed, do not reinstate |
| 44% to 48% underrepresented representation on shortlists | outcomes grid; finance and tech examples | Founder | None | removed |
| 0 missed pre-opening dates across six hospitality sites | outcomes grid; hospitality example | Founder | None | removed |
| 9.1/10 client shortlist rating (example and metrics strip) | finance example; case-study-metrics | Founder | None | removed from example; gated in metrics |
| 94% / 91% / 92% 12-month retention | healthcare, hospitality examples; case-study-metrics | Founder | None. The platform cannot evidence 12-month retention | removed from examples; gated in metrics |
| 88%, 84%, 86% offer acceptance on examples | hospitality, industrial examples; case-study-metrics | Founder | None | removed from examples; gated in metrics |
| Time to shortlist 4, 5, 6, 7, 9 and 10 days, median 7d | example engagements; case-study-metrics | Founder | Replaced by the offer-facts timing: usually 5 business days from an approved brief, not a guarantee | replaced; metric gated |
| All 42 / 18 / 34 / 27 / 23 / 31 positions filled, offers signed by day N | example engagements | Founder | None | removed. Scope counts now describe the example brief only |
| 175+ positions delivered | case-study-metrics | Founder | None | gated |
| 18 cities engaged; "Three regions, eighteen cities" map | case-study-metrics; global reach section | Founder | None | gated; map section removed |
| "3 hospitality groups, 2 PE funds, 1 clinic network..." engagement counts | trust strip | Founder | None | removed |
| "Under 10 days" to first shortlist | case-studies call to action | Founder | Replaced with offer-facts timing | removed |
| Named testimonials and client results (SafiTech, Sterling Law Partners, Meridian Regional Bank) | legacy content/pages/case-studies.json body | Founder | None; the page does not render this body | removed from the file |

Metric definitions now stated on the page: offer acceptance rate is accepted offers divided by offers extended. Shortlist-to-hire rate is a different ratio and is not comparable to it.

## Healthcare

| Claim | Where | Owner | Evidence on record | Approval status |
| :--- | :--- | :--- | :--- | :--- |
| HIPAA-aware handling is a default posture | industries healthcare FAQ | Founder | The security page states no HIPAA certification | removed |
| HIPAA-compliant talent with credential verification | legacy industries/healthcare.json meta | Founder | None | removed |
| 100% HIPAA trained, 95% credential accuracy, 72-hour urgent staffing, 350+ healthcare placements | legacy industries/healthcare.json body (not rendered while the v2 entry exists) | Founder | None | not rendered; legacy file only |
| Manufacturing and devices (GMP production, validation, device engineering) shown on the healthcare page | shared vertical configuration | Product | Belongs to pharma and medical devices | healthcare override added; shared config unchanged |
| Setting-specific experience (acute, community, GMP, GCP) as a healthcare requirement pattern | shared vertical configuration | Product | Belongs to pharma and medical devices | healthcare override added |
| Time-to-fill 62 to 88 days, cost per hire, offer acceptance 72% to 84%, source-of-hire mix, 90-day attrition and every other figure in "Healthcare Hiring Benchmarks 2026" | blog post healthcare-hiring-benchmarks-2026 | Editorial | Only a generic "SHRM, LinkedIn, BLS" line, not a citation | removed; post rewritten as a definitions guide with a labelled illustrative example |
| Unattributed quote from "a VP of Talent Acquisition in Columbus, Ohio" | same post | Editorial | None | removed |
| "Written and reviewed by the TaaSFlow editorial desk"; "benchmarks checked against published sources" | blog author note | Editorial | No reviewer on record | removed; team byline only |

## Blog

| Claim | Where | Owner | Evidence on record | Approval status |
| :--- | :--- | :--- | :--- | :--- |
| SaaS Workforce Outlook 2026 (70/30 and 65/35 workforce ratios, nearshore pods) | blog post saas-workforce-outlook-2026 | Editorial | Describes a different business model | withdrawn from the live set (status draft); file kept |

## Blog consolidation

The audit finding was five templated posts per industry. For each of ten industries (accounting, cybersecurity, data-analytics, finance, healthcare, insurance, legal, private-equity, saas, tech) the posts were merged into one guide, `/blog/<industry>-hiring-guide-2026`, byline TaaSFlow Editorial Team. Publish date is 2026-07-23, the earliest date of the originals; it was not refreshed. The old URLs 301 to the guide (`src/content/blog-redirects.ts`, honoured in `src/routes/blog.$slug.tsx`); the 47 old files are kept as drafts with the industry key renamed to `draftIndustry`, as for saas-workforce-outlook-2026. Live posts: 119 before, 83 after (10 added, 46 retired; saas-workforce-outlook-2026 was already withdrawn and now redirects too).

| Merged | Retired slugs (redirect to the guide) | Owner | Approval status |
| :--- | :--- | :--- | :--- |
| 10 industry guides | `<industry>-hiring-benchmarks-2026`, `-top-roles-compensation-2026`, `-emerging-skills-shift-2026`, `-retention-culture-playbook`, `-workforce-outlook-2026` (legal had two of the five; saas-workforce-outlook-2026 was already a draft) | Editorial | Published as team-byline guides; needs owner read-through |

Statistics dropped (none carried into the guides; no source was on record for any of them):

| Dropped claim type | Example from the retired posts | Treatment in the guide |
| :--- | :--- | :--- |
| Time-to-fill ranges by role | "Staff Accountant 38-48 days", "Senior Accountant 68-82 days" | removed; definitions and a stage-by-stage method instead |
| Source-of-hire and channel percentages | "Employee referrals 32% of hires" | removed |
| Role-by-role pay bands labelled "National Tier 2 average", compensation matrices | accounting top-roles post and equivalents | removed; guides say how to build a range from own bands, public wage data and declined offers |
| City-by-city benchmarks and "markets gaining/losing share" | Charlotte, Austin, Salt Lake City, Chicago, Tampa | removed |
| Attrition and cost-of-churn figures, ROI model for a 20-person team | accounting retention playbook | removed; replaced by hypotheses to test against own exit data |
| Workforce-supply, demand and AI-adoption percentages across the other industries | outlook and skills-shift posts | removed |

Illustrative examples that remain are labelled as such with their assumptions stated (vacancy cost, on-call recovery time, ramp cost, funnel, rebuild timeline). They are placeholders for the reader's own data, not market data. Guides name public sources to check (for example the Bureau of Labor Statistics occupational data, the NICE Workforce Framework) without quoting figures from them.

Links to retired slugs still present outside the blog content (they resolve through the 301): `src/content/pages/blog.json`, `about.json`, `how-it-works.json` and the industry JSON files under `src/content/industries/` (finance, healthcare, insurance, legal, private-equity, tech). Update them when those files are next edited.

## General blog posts

Scope: the 73 live blog posts that are not industry-tagged. Full per-post detail, with before and after counts, is in `docs/seo/blog-inventory.md`. No external source could be verified (outbound requests were blocked), so no citation was added; every figure without a verifiable source was removed or recast.

| Item | Count |
| :--- | ---: |
| Posts audited | 73 |
| Posts rewritten (statistics removed or recast, retired CTAs replaced, anecdotes removed) | 71 |
| Posts retained with only the retired CTA block replaced | 2 (`reference-check-mastery`, `rejection-with-grace`) |
| Percentage and dollar figures in the original text (regex matches) | 910 |
| Percentage and dollar figures remaining | 53 (all inside examples labelled illustrative with assumptions stated, or the standard pilot price) |
| Other numeric claims removed or recast (multipliers, N of M, durations, large numbers) | 227 of 281 (those left are recommended time windows such as a 30-60-90 plan, or sit inside labelled illustrations) |
| Posts with an invented anecdote, composite client, claim of TaaSFlow data or results, or an unlinked named source | 43 |
| Posts whose meta title or description carried a figure | 16 (rewritten where the figure was unsourced) |
| External citations added | 0 |

Claim types removed, with no source on record for any of them:

| Claim type | Example | Treatment |
| :--- | :--- | :--- |
| Market statistics attributed to a named body with no link | SHRM cost per hire, AICPA candidate counts, Deloitte survey results, "Stanford research", "Talent Board" | removed; posts tell the reader to use a named, dated source |
| Salary, OTE and compensation tables | `salary-trends-2026-comprehensive`, SaaS and sales hiring posts, AI/ML and RevOps role tables | removed; the salary trends post is now a how-to on building a benchmark |
| Invented anecdotes and named composites | "Sarah" in Denver, a Charlotte bank, a Columbus manufacturer, a Denver teacher, a VP of Engineering | removed, or recast as an unnamed, labelled illustrative scenario |
| TaaSFlow internal data and client results | "Data compiled by TaaSFlow", "analysis of 50,000 placements", "TaaS clients typically see", "internal placement metrics" | removed |
| Studies and surveys with no source | "study of 10,000 negotiations", "450 distributed technology firms", "interviews with 30 board members", "140 growth-stage firms" | removed |
| Benchmark callouts | "Benchmark:" blocks in 20 posts | removed or replaced with a "Measure it" prompt |
| Product claims | pre-screened and pre-scored candidates "in days", weekly deliveries, plan-tier capacity, "30+ countries", price quotes for named plans | replaced with the standard description (agents source and score, a recruiter reviews each shortlist, you decide) and the pilot facts from `offer-facts.ts` |
| Retired CTAs | "Start a risk-free pilot", "Book a free 30-minute consultation", "Explore ... solutions" | replaced with the labels in `src/config/cta.ts` |

Illustrative examples that remain state their assumptions and are marked as illustrative (cost-per-hire, replacement cost, vacancy cost, candidate drop-off, offer acceptance arithmetic). They are placeholders for the reader's own numbers, not market data and not client results.

Needs owner review:

| Item | Owner | Approval status |
| :--- | :--- | :--- |
| 26 thin posts proposed for noindex and 13 duplicates proposed for consolidation (list in the inventory) | Editorial and SEO | needs owner decision; the blog route has no per-post noindex field, so none is applied yet (needs noindex support) |
| `salary-trends-2026-comprehensive`: originally a data-only report with no sources; now a short how-to | Editorial | needs owner decision: delete, replace with a sourced report, or keep |
| `blockchain-credentials-hiring`: speculative topic on credential verification; TaaSFlow does not verify credentials | Founder | needs owner decision on whether the topic fits positioning |
| Legal and regulatory content in `background-check-best-practices`, `second-chance-hiring-guide`, `remote-first-compensation-guide` and the AI screening posts is general information, now hedged, with no legal review on record | Legal | needs owner review |
| Any claim the owner wants back needs a named, dated source and an owner-recorded approval before it returns | Editorial | removed |

## Resources

| Claim | Where | Owner | Evidence on record | Approval status |
| :--- | :--- | :--- | :--- | :--- |
| "No fabricated statistics — every claim links to its source"; "every insight links to its full source"; "Every claim sourced"; "Reviewed regularly" | /resources | Editorial | Not true of every resource | removed; wording now states that figures appear only where a source is named |

## Other blog posts and legacy content: not yet audited

The 300+ other blog posts and the legacy industry JSON files carry statistics of unknown provenance. They are outside this pass and need a separate audit. Needs owner decision: whether to remove, source or label each post.

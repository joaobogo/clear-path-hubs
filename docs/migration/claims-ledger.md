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

## Resources

| Claim | Where | Owner | Evidence on record | Approval status |
| :--- | :--- | :--- | :--- | :--- |
| "No fabricated statistics — every claim links to its source"; "every insight links to its full source"; "Every claim sourced"; "Reviewed regularly" | /resources | Editorial | Not true of every resource | removed; wording now states that figures appear only where a source is named |

## Other blog posts and legacy content: not yet audited

The 300+ other blog posts and the legacy industry JSON files carry statistics of unknown provenance. They are outside this pass and need a separate audit. Needs owner decision: whether to remove, source or label each post.

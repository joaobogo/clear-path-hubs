# TAASFLOW V2 — Public Website Full Parity Audit

Source: https://taasflow.com
Destination: https://clear-path-hubs.lovable.app

## Scope
- Audited: marketing_static, industry_page, industries_index, industries_compare, blog_category_index, utility
- Excluded (per user scope): dashboards, employer intake, Job Board, job details, application, application tracking
- Excluded (deferred): blog_article (304 pages, opt-in via `--include-blog`)
- Implementation files changed: **0** (read-only measurement)

## Totals
- totalSourcePublicRoutes: 352
- totalSourcePublicRoutesExcludingBlogAndJobs: 48
- totalDestinationRoutesAudited: 48
- routesPassing: 0
- routesFailing: 48
- missingRoutes: 1
- brokenRoutes: 0
- missingSections: 47
- missingAssets: 46
- brokenCTAs: 0
- brokenLinks: 0
- seoFailures: 48
- mobileFailures: 1
- protectedRouteChangesDetected: 0
- consoleErrorRoutes: 2

## Per-route
| Source | Destination | Result | Severity | Bucket | Missing sections | Missing assets | SEO | Responsive | A11y | Console |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/about` | `/about` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 14 | 3 | 3 | 0 | 1 | 0 |
| `/blog` | `/blog` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 9 | 2 | 1 | 0 | 1 | 0 |
| `/blog/category/*` | `/blog/category/$slug` | MISSING_ROUTE | CRITICAL | missing_route | 9 | 2 | 4 | 0 | 1 | 1 |
| `/candidate-success` | `/candidate-success` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 3 | 1 | 3 | 0 | 1 | 0 |
| `/candidate/join` | `/candidate-join` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 1 | 1 | 4 | 0 | 1 | 0 |
| `/case-studies` | `/case-studies` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 3 | 1 | 3 | 0 | 1 | 0 |
| `/contact` | `/contact` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 1 | 1 | 3 | 0 | 1 | 0 |
| `/employer-onboarding` | `/employer-onboarding` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 5 | 2 | 3 | 0 | 0 | 0 |
| `/enterprise` | `/enterprise` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 11 | 6 | 3 | 0 | 0 | 0 |
| `/faq` | `/faq` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 3 | 1 | 2 | 0 | 1 | 0 |
| `/global-talent` | `/global-talent` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 9 | 1 | 3 | 0 | 1 | 0 |
| `/how-it-works` | `/how-it-works` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 15 | 4 | 1 | 0 | 0 | 0 |
| `/` | `/` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 17 | 6 | 1 | 0 | 1 | 0 |
| `/industries` | `/industries` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 3 | 1 | 3 | 0 | 1 | 0 |
| `/industries/accounting` | `/industries/accounting` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 16 | 5 | 3 | 0 | 0 | 0 |
| `/industries/compare` | `/industries/compare` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 2 | 1 | 3 | 0 | 1 | 0 |
| `/industries/construction` | `/industries/construction` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 17 | 5 | 3 | 0 | 0 | 0 |
| `/industries/consulting` | `/industries/consulting` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 17 | 4 | 3 | 0 | 0 | 0 |
| `/industries/cybersecurity` | `/industries/cybersecurity` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 17 | 4 | 3 | 0 | 0 | 0 |
| `/industries/data-analytics` | `/industries/data-analytics` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 16 | 5 | 3 | 0 | 0 | 0 |
| `/industries/ecommerce` | `/industries/ecommerce` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 17 | 5 | 3 | 0 | 0 | 0 |
| `/industries/finance` | `/industries/finance` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 17 | 5 | 3 | 0 | 0 | 0 |
| `/industries/healthcare` | `/industries/healthcare` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 17 | 4 | 3 | 0 | 0 | 0 |
| `/industries/hospitality` | `/industries/hospitality` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 17 | 5 | 3 | 0 | 0 | 0 |
| `/industries/human-resources` | `/industries/human-resources` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 16 | 4 | 3 | 0 | 0 | 0 |
| `/industries/insurance` | `/industries/insurance` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 17 | 4 | 3 | 0 | 0 | 0 |
| `/industries/legal` | `/industries/legal` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 17 | 4 | 3 | 0 | 0 | 0 |
| `/industries/marketing` | `/industries/marketing` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 17 | 5 | 3 | 0 | 0 | 0 |
| `/industries/media` | `/industries/media` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 16 | 5 | 3 | 0 | 0 | 0 |
| `/industries/non-profit` | `/industries/non-profit` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 16 | 2 | 3 | 0 | 1 | 1 |
| `/industries/private-equity` | `/industries/private-equity` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 17 | 5 | 3 | 0 | 0 | 0 |
| `/industries/public-sector` | `/industries/public-sector` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 17 | 4 | 3 | 0 | 0 | 0 |
| `/industries/real-estate` | `/industries/real-estate` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 17 | 4 | 3 | 0 | 0 | 0 |
| `/industries/saas` | `/industries/saas` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 17 | 5 | 3 | 0 | 0 | 0 |
| `/industries/sales` | `/industries/sales` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 17 | 4 | 3 | 0 | 0 | 0 |
| `/industries/staffing-agencies` | `/industries/staffing-agencies` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 16 | 5 | 3 | 0 | 0 | 0 |
| `/industries/tech` | `/industries/tech` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 17 | 4 | 3 | 0 | 0 | 0 |
| `/knowledge-base` | `/knowledge-base` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 3 | 1 | 3 | 0 | 1 | 0 |
| `/partnerships/staffing` | `/partnerships/staffing` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 7 | 2 | 3 | 0 | 0 | 0 |
| `/pilot` | `/pilot` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 3 | 2 | 3 | 0 | 0 | 0 |
| `/pricing` | `/pricing` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 11 | 2 | 1 | 0 | 0 | 0 |
| `/privacy` | `/privacy` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 17 | 1 | 3 | 0 | 1 | 0 |
| `/resources` | `/resources` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 3 | 1 | 3 | 0 | 1 | 0 |
| `/sitemap.xml` | `/sitemap.xml` | PASS | HIGH | responsive_failures | 0 | 0 | 3 | 1 | 1 | 0 |
| `/taasflow-journey` | `/journey` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 1 | 0 | 4 | 0 | 1 | 0 |
| `/talent-network` | `/talent-network` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 4 | 1 | 3 | 0 | 1 | 0 |
| `/talent` | `/talent-marketplace` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 4 | 1 | 4 | 0 | 1 | 0 |
| `/terms` | `/terms` | MAJOR_DIFFERENCE | CRITICAL | missing_major_sections | 16 | 1 | 3 | 0 | 1 | 0 |
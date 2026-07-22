# Public Route Inventory — TaaSFlow V2 Migration

Source: `https://sourcing-suite-ai.lovable.app` (and its live parent `https://taasflow.com`).
Destination: `https://clear-path-hubs.lovable.app`.
Phase: **read-only inventory + planning**. No source app code is imported.

## Counts

- Public pages: **19**
- Industry pages: **24** (1 index + 1 compare + 22 industry leaves)
- Blog articles (sitemap): **304**
  - Rich content captured: **72**
  - Sparse / not-yet-captured: **232** (source host throws intermittent `ERR_SSL_PROTOCOL_ERROR`; needs single-threaded re-crawl)

## Decision summary (pages)

- **KEEP_NEW_IMPLEMENTATION**: 2
- **MIGRATE**: 9
- **REDIRECT**: 1
- **REWRITE_FOR_V2**: 2
- **VERIFY**: 5

## Pages

| Slug | Source URL | Destination | Decision | Notes |
|---|---|---|---|---|
| about | https://taasflow.com/about | /about | MIGRATE | Copy stays; verify stats (20,000+ / 80+ / 50+). |
| blog | https://taasflow.com/blog | /blog | KEEP_NEW_IMPLEMENTATION | V2 blog index built from scraped content. |
| case-studies | https://taasflow.com/case-studies | /case-studies | VERIFY | Verify each client story with sales; may be REMOVE if unverified. |
| contact | https://taasflow.com/contact | /contact | REWRITE_FOR_V2 | Wire form to V2 intake or a lightweight contact server fn. |
| employer-onboarding | https://taasflow.com/employer-onboarding | /employer-onboarding | REDIRECT | Redirect to /intake — V2 employer intake is canonical. |
| enterprise | https://taasflow.com/enterprise | /enterprise | MIGRATE | Copy stays; CTA to /contact or /intake. |
| faq | https://taasflow.com/faq | /faq | MIGRATE | Copy stays; verify answers referencing pricing/timeline. |
| global-talent | https://taasflow.com/global-talent | /global-talent | MIGRATE | Copy stays; verify country counts. |
| how-it-works | https://taasflow.com/how-it-works | /how-it-works | MIGRATE | Copy stays; update screenshots to V2 dashboards. |
| index | https://taasflow.com/ | / | REWRITE_FOR_V2 | New homepage must foreground the Client workspace / ranked-candidates differentiator. |
| jobs | https://taasflow.com/jobs | /jobs | KEEP_NEW_IMPLEMENTATION | V2 Job Board is canonical; do not import old logic. |
| knowledge-base | https://taasflow.com/knowledge-base | /knowledge-base | MIGRATE | Content directory; link items to /blog articles. |
| partnerships-staffing | https://taasflow.com/partnerships/staffing | /partnerships/staffing | MIGRATE | Staffing-partner page; keep. |
| pilot | https://taasflow.com/pilot | /pilot | VERIFY | Verify pilot terms; wire CTA to /intake. |
| pricing | https://taasflow.com/pricing | /pricing | VERIFY | Verify $399 pilot and subscription tiers before publishing. |
| privacy | https://taasflow.com/privacy | /privacy | VERIFY | Legal review required. |
| resources | https://taasflow.com/resources | /resources | MIGRATE | Hub linking to blog + knowledge base. |
| talent-network | https://taasflow.com/talent-network | /talent-network | MIGRATE | Candidate acquisition page; CTA to /jobs. |
| terms | https://taasflow.com/terms | /terms | VERIFY | Legal review required. |

## Industries

| Slug | Source URL | Destination | Decision |
|---|---|---|---|
| accounting | https://taasflow.com/industries/accounting | /industries/accounting | MIGRATE |
| compare | https://taasflow.com/industries/compare | /industries/compare | MIGRATE |
| construction | https://taasflow.com/industries/construction | /industries/construction | MIGRATE |
| consulting | https://taasflow.com/industries/consulting | /industries/consulting | MIGRATE |
| cybersecurity | https://taasflow.com/industries/cybersecurity | /industries/cybersecurity | MIGRATE |
| data-analytics | https://taasflow.com/industries/data-analytics | /industries/data-analytics | MIGRATE |
| ecommerce | https://taasflow.com/industries/ecommerce | /industries/ecommerce | MIGRATE |
| finance | https://taasflow.com/industries/finance | /industries/finance | MIGRATE |
| healthcare | https://taasflow.com/industries/healthcare | /industries/healthcare | MIGRATE |
| hospitality | https://taasflow.com/industries/hospitality | /industries/hospitality | MIGRATE |
| human-resources | https://taasflow.com/industries/human-resources | /industries/human-resources | MIGRATE |
| index | https://taasflow.com/industries | /industries | MIGRATE |
| insurance | https://taasflow.com/industries/insurance | /industries/insurance | MIGRATE |
| legal | https://taasflow.com/industries/legal | /industries/legal | MIGRATE |
| marketing | https://taasflow.com/industries/marketing | /industries/marketing | MIGRATE |
| media | https://taasflow.com/industries/media | /industries/media | MIGRATE |
| non-profit | https://taasflow.com/industries/non-profit | /industries/non-profit | MIGRATE |
| private-equity | https://taasflow.com/industries/private-equity | /industries/private-equity | MIGRATE |
| public-sector | https://taasflow.com/industries/public-sector | /industries/public-sector | MIGRATE |
| real-estate | https://taasflow.com/industries/real-estate | /industries/real-estate | MIGRATE |
| saas | https://taasflow.com/industries/saas | /industries/saas | MIGRATE |
| sales | https://taasflow.com/industries/sales | /industries/sales | MIGRATE |
| staffing-agencies | https://taasflow.com/industries/staffing-agencies | /industries/staffing-agencies | MIGRATE |
| tech | https://taasflow.com/industries/tech | /industries/tech | MIGRATE |

## Blog

- Full per-article table lives in `public-route-inventory.json` under `blog.rich_samples` / `blog.sparse_samples`.
- Decision for every eligible article: **MIGRATE** into `/blog/$slug`, provided `content_len > 400` (rich) OR the sparse re-crawl succeeds.
- Sparse articles are **EXCLUDE (pending re-crawl)** until body content is recovered. They are already in the sitemap so URLs stay stable when content lands.

## Excluded from migration

- `/dashboard`, `/admin`, `/client`, `/candidate` and any authenticated route on the source — V2 dashboards are canonical (see Section 7).
- Legacy Storage / signed URLs (never copied; assets re-scraped from HTML `<img>` src on the public origin).
- Test/duplicate blog drafts (none discovered above the sparse threshold).

## Broken public references found

- 232 blog URLs return SSR shell but no article HTML under concurrent scraping. Not broken for end users; scraper-side flakiness. Track under `blog.sparse_samples`.
- No 404s observed on the 19 canonical pages or the 24 industry pages.

# Prompts 26 & 27 — Industry Batch QA Report

**Status: PASS (both prompts)**

Framework: reusable `IndustryTemplate` (see `docs/industries/reusable-page-template.md`).
Data: canonical structured entries in `src/content/industries-v2.ts` and `src/content/industries-batch2.ts`.
Images: canonical `docs/industries/image-manifest.json` (57 unique Unsplash IDs) + code-side registries `src/content/industry-hero-photos.ts` and `src/content/industry-hero-images.ts`.

## Prompt 26 — Technology & Digital (7 pages)

| Slug | Route | Title | Hero ID | Errors@5vp |
|---|---|---|---|---|
| tech | /industries/tech | Technology hiring — TaaSFlow | 1517430816045-df4b7de11d1d | 0 |
| ai-ml | /industries/ai-ml | AI & Machine Learning hiring — TaaSFlow | 1677442136019-21780ecad995 | 0 |
| cybersecurity | /industries/cybersecurity | Cybersecurity hiring — TaaSFlow | 1550751827-4bd374c3f58b | 0 |
| data-analytics | /industries/data-analytics | Data & analytics hiring — TaaSFlow | 1543286386-713bdd548da4 | 0 |
| devops | /industries/devops | DevOps & Cloud hiring — TaaSFlow | 1573164713714-d95e436ab8d6 | 0 |
| web3 | /industries/web3 | Web3 & Blockchain hiring — TaaSFlow | 1639762681485-074b7f938ba0 | 0 |
| gaming | /industries/gaming | Gaming hiring — TaaSFlow | 1542751371-adc38448a05e | 0 |

## Prompt 27 — Financial & Professional Services (12 pages)

Category assignment follows `docs/industries/taxonomy.md`. Public Sector is
classified under **Regulated & Public** in the manifest, not Financial /
Professional — included here because the prompt requested it; documented per
scope note.

| Slug | Route | Title | Hero ID | Errors@5vp |
|---|---|---|---|---|
| accounting | /industries/accounting | Accounting hiring — TaaSFlow | 1554224154-26032ffc0d07 | 0 |
| finance | /industries/finance | Finance hiring — TaaSFlow | 1554224155-8d04cb21cd6c | 0 |
| fintech | /industries/fintech | FinTech hiring — TaaSFlow | 1611974789855-9c2a0a7236a3 | 0 |
| insurance | /industries/insurance | Insurance hiring — TaaSFlow | 1450101499163-c8848c66ca85 | 0 |
| investment-banking | /industries/investment-banking | Investment Banking hiring — TaaSFlow | 1554224155-6726b3ff858f | 0 |
| private-equity | /industries/private-equity | Private equity hiring — TaaSFlow | 1519389950473-47ba0277781c | 0 |
| venture-capital | /industries/venture-capital | Venture Capital hiring — TaaSFlow | 1556761175-5973dc0f32e7 | 0 |
| wealth-management | /industries/wealth-management | Wealth Management hiring — TaaSFlow | 1560520653-9e0e4c89eb11 | 0 |
| legal | /industries/legal | Legal hiring — TaaSFlow | 1589994965851-a8f479c573a9 | 0 |
| consulting | /industries/consulting | Consulting hiring — TaaSFlow | 1517502884422-41eaead166d4 | 0 |
| proptech | /industries/proptech | PropTech hiring — TaaSFlow | 1486406146926-c627a92ad1ab | 0 |
| public-sector | /industries/public-sector | Public sector hiring — TaaSFlow | 1541872703-74c5e44368f9 | 0 |

## Batch-wide checks

| Check | Result |
|---|---|
| Repeated hero images across the 19-page batch | **0** |
| Repeated hero images globally (57-manifest) | **0** |
| Duplicated `meta.title`, `meta.description`, `hero.headline`, or `hero.subhead` across batch | **0** |
| Direct URL + hard refresh at 320 / 375 / 768 / 1024 / 1440 | **PASS** (all 19 pages × 5 viewports = 95 renders, zero page errors) |
| Role explorer + signal explorer interactive | PASS (shared components `IndustryRoleExplorer`, `IndustrySignalExplorer`) |
| Related resources block (guides + pricing + how-it-works + category article) | PASS |
| Related industries (engine-driven, 3–5 links per page) | PASS (via `industry-link-graph.json`) |
| CTA links (Book a call dialog + `/apply`, `/pricing`, `/how-it-works`) | PASS |
| Metadata uniqueness (title, description, og:*, canonical, FAQ JSON-LD) | PASS |
| Unsupported regulatory claims | **0** (all compliance language framed as "rubric per {domain}", no certification guarantees) |
| Generic name-substitution copy | **0** (each hero headline and subhead written per industry) |

## Compliance-sensitive language guardrails (Prompt 27)

Every finance/legal/regulated page frames verification as **evidence
extracted from the CV**, not as a compliance certification. No page claims:
- to run background checks
- to verify bar admission / SRA / CPA / CFA status with authorities
- to provide legal, financial, tax, or investment advice
- SOC 2 / ISO / regulator-issued endorsements TaaSFlow does not hold

Certifications and licences appear in the "Skills, tools, licences" section
as **candidate signals to look for**, not as TaaSFlow-issued guarantees.

## Screenshots

`/tmp/browser/p26_27/screens/{slug}_{320|375|768|1024|1440}.png` — 95 images.
Full run report: `/tmp/browser/p26_27/report.json`.

## Changed files

- `docs/industries/prompt-26-27-batch-report.md` (this file)

No content or component changes were required: the 19 industry entries were
already fully populated by prior phases and each satisfies the reusable-
template contract. All PASS criteria met.

# 00 Baseline and route manifest

Purpose: record the code baseline the SEO/CRO work started from, the framework and test commands, and a manifest of every public route with its indexability, sitemap membership, canonical and authentication behaviour. It is derived from the current source (route files, `src/lib/seo/*`, `src/config/legacy-redirects.ts`, `src/content/blog-redirects.ts`) and is a snapshot, not a live crawl. Re-verify against production with the curl matrix in `06-release-checklist.md`.

Last updated: 7 October 2026

## 1. Baseline

| Item | Value | Source |
| --- | --- | --- |
| Baseline commit (audit pin) | `5a8ceb2` "Fixed login redirects and UX" (25 September 2026 per the playbook) | `git log`; playbook p. 2 |
| Commits on top of baseline (at time of writing) | `f00c531` SEO, `aca4f06` Funnel, `b1dcfdb` Pricing, `7eaf52a` Product pages, `0bd07f9` Legal and trust, `7956431` Homepage and navigation, `16fc1dd` Content, `eb6477e` FAQ, `16a1886` Blog, `e275a94` Compare, `12fa29f` Structure, `96c2ba6` Leftovers | `git log 5a8ceb2..HEAD` |
| Uncommitted work | The working tree had many uncommitted changes while this was written and none were listed at the end. Re-run `git status` before relying on this document. | `git status` |
| Framework | TanStack Start (`@tanstack/react-start`) with TanStack Router file routes, React 19, Vite 8. Build target is Nitro (Cloudflare default, per `vite.config.ts` comment). Output goes to `.output/`. | `package.json`, `vite.config.ts` |
| Backend | Supabase (database, auth, storage). | `src/integrations/supabase`, `src/routes/api/public/*` |
| Canonical origin | `https://taasflow.com` (apex). `www.` 301s to apex. | `src/lib/canonical-origin.ts`, `src/start.ts` |
| Preview hosts | `*.lovable.app`, `*.lovableproject.com`, `*.lovable.dev` receive `noindex, nofollow` in HTML and `X-Robots-Tag`. | `src/lib/seo/edge-policy.ts`, `src/routes/__root.tsx` |
| Payments | `PAYMENTS_ENABLED = false` | `src/config/commerce.ts` |
| Production deployed revision | Unknown. Owner to confirm (the playbook requires rechecking it before release). | n/a |

## 2. Commands

| Purpose | Command |
| --- | --- |
| Build (runs `prebuild` first: robots.txt and ai.txt generation, `check:vocabulary`, `check:kpi-sync`, `check:scaled-content`, `check:internal-links`) | `npm run build` |
| Typecheck | `npm run typecheck` |
| Unit tests | `npm run test` (vitest) |
| Vocabulary guards (public, client, no-card processor) | `npm run check:vocabulary` |
| KPI sync | `npm run check:kpi-sync` |
| Scaled-content guard | `npm run check:scaled-content` |
| Internal links | `npm run check:internal-links` |
| Structured data | `npm run check:structured-data` |
| Release gate (checks, full tests, e2e smoke, e2e performance) | `npm run release:gate` |
| Lint | `npm run lint` |
| Header length audit (warnings only) | `npx vitest run src/lib/seo/__tests__/head-length-audit.test.ts` |
| SEO suites | `npx vitest run src/lib/seo src/content/__tests__ src/routes/__tests__` |

### Known pre-existing failing tests

These need Supabase environment variables that are not present in a plain checkout. They are not caused by the SEO/CRO work.

| Test file | Reason |
| --- | --- |
| `src/lib/__tests__/message-history-log.test.ts` | Needs Supabase env |
| `src/lib/__tests__/messaging-history.test.ts` | Needs Supabase env |

## 3. Indexing rules in code

| Rule | Where |
| --- | --- |
| Sitemap is an index (`/sitemap.xml`) pointing at `/sitemap-pages.xml`, `/sitemap-industries.xml`, `/sitemap-blog.xml`. `lastmod` only when a real date exists; no `changefreq` or `priority`. | `src/lib/seo/index-config.ts` |
| Static sitemap paths (33) are the `STATIC_PATHS` array; 11 `/resources/<slug>` guides are appended. | `index-config.ts` |
| Static paths that emit `noindex` and stay out of the sitemap: `/status`, `/changelog`, `/candidate-success`, `/knowledge-base`, `/talent-marketplace`, `/global-talent`, `/pitch`, `/sitemap`, `/intake`, `/sample-shortlist`. | `NOINDEX_STATIC_PATHS`, `src/lib/seo/indexability.ts` |
| Indexable industries: `hospitality`, `healthcare` (page and briefing). Every other industry page and briefing is `noindex, follow` and not in the sitemap. | `INDEXABLE_INDUSTRY_SLUGS` |
| 26 blog posts are `noindex, follow` and excluded from `/sitemap-blog.xml`. | `src/lib/seo/blog-noindex.ts` |
| One robots group (`User-agent: *`), AI crawlers allowed by design. Disallowed: `/admin`, `/client`, `/me`, `/boardroom`, `/login`, `/auth`, `/checkout`, `/share/`, `/shortlist/`, `/api/`, `/_authenticated/`, `/reset-password`, `/access-denied`, `/unauthorized`, `/brand-center`, `/dev/`, `/dev.catalogue`, `/dev.industry-coverage`, `/lovable/`. | `src/lib/seo/robots-config.ts` |
| Sitemap size at time of writing (computed from the generator): 44 page URLs, 4 industry URLs, 78 blog URLs (21 category pages plus 57 posts; 83 rows minus 26 noindexed). | computed via `collectSitemapEntriesByGroup` |
| Canonical tag is `https://taasflow.com` + path, built by `marketingHead()`. Titles are clamped to 59 characters and descriptions to 158 by the helper (see `05-metadata-and-schema-inventory.md`). | `src/lib/marketing/head.ts` |
| Case-insensitive paths 301 to lower case (except `/share/`, `/apply/`, `/lovable/`, `/api/`, `/assets/`, `/_`, and anything with a file extension). | `src/start.ts` `canonicalPathFor` |
| HTML cache: `public, max-age=0, must-revalidate`; private/no-cache for auth paths. | `src/lib/seo/edge-policy.ts` |

## 4. Route manifest (public routes)

"Auth" is what the route itself requires. "Canonical" is self (`https://taasflow.com` + the path) unless stated. All indexable pages below are in the sitemap; everything marked "no" for indexable is out of the sitemap.

### 4.1 Marketing and money pages

| Path | Template | Indexable | In sitemap | Canonical | Auth |
| --- | --- | --- | --- | --- | --- |
| `/` | Homepage (`index.tsx`, content entry `index`) with embedded employer inquiry form | Yes | Yes | self | None |
| `/pricing` | Editorial hero, tier cards, entitlement matrix | Yes | Yes | self | None |
| `/pilot` | Pilot page with employer inquiry form | Yes | Yes | self | None |
| `/how-it-works` | Editorial hero page; folded in `/platform`, `/system`, `/employer-onboarding` | Yes | Yes | self | None |
| `/security` | Editorial hero page; folded in `/trust` | Yes | Yes | self | None |
| `/about` | Content page with leadership cards; folded in `/journey` | Yes | Yes | self | None |
| `/faq` | Native `<details>` FAQ (answers in server HTML) | Yes | Yes | self | None |
| `/case-studies` | Labelled example engagements | Yes | Yes | self | None |
| `/for-hr-teams`, `/for-founders` | `AudiencePage` | Yes | Yes | self | None |
| `/solutions`, `/enterprise` | Marketing pages | Yes | Yes | self | None |
| `/flat-fee-recruiting`, `/subscription-recruiting`, `/recruitment-agency-alternative`, `/ai-recruiting-agency`, `/recruiting-as-a-service` | `MoneyPageView` (`src/content/money-pages.ts`) | Yes | Yes | self | None |
| `/compare`, `/compare/recruiting-agencies`, `/recruiter-fees` | `ComparePageView` (`src/content/compare-pages.ts`) | Yes | Yes | self | None |
| `/ai-in-hiring` | Marketing page | Yes | Yes | self | None |
| `/agents`, `/integrations` | Marketing pages from `agent-roster.ts`, `integrations-directory.ts` | Yes | Yes | self | None |
| `/contact` | Contact form page | Yes | Yes | self | None |
| `/privacy`, `/terms` | Legal content entries | Yes | Yes | self | None |
| `/partnerships/staffing` | Marketing page | Yes | Yes | self | None |
| `/talent-network`, `/candidate-join` | Candidate-facing pages | Yes | Yes | self | None |
| `/resources`, `/resources/<slug>` (11 guides) | Resource index and guides | Yes | Yes | self | None. An unknown slug returns not-found with `noindex`. |
| `/industries` | Industry index | Yes | Yes | self | None |
| `/industries/healthcare`, `/industries/hospitality` and `/briefing` of each | `IndustryPage` | Yes | Yes | self | None |
| other `/industries/<slug>` and `/industries/<slug>/briefing` | `IndustryPage` | No: `noindex, follow` (not in `INDEXABLE_INDUSTRY_SLUGS`) | No | self | None |
| `/blog` (and `/blog?page=N`) | Paginated archive | Yes | `/blog` yes; `?page=N` not listed | self-canonical per page | None |
| `/blog/category/<slug>` (21) | Category archive | Yes | Yes | self | None |
| `/blog/<slug>` (57 indexable of 83 rows) | Blog post | Yes | Yes | self | None |
| `/blog/<slug>` (26 listed in `blog-noindex.ts`) | Blog post | No: `noindex, follow` "pending review" | No | self | None |
| `/jobs` | Job board index | Yes | Yes | self | None |
| `/jobs/<id>` | Role page with `JobPosting` JSON-LD | Open role: no robots tag (indexable). Closed role: `noindex, follow`. Unavailable: `noindex`. | No: the sitemap lists `/jobs` only, not role pages | `/jobs/<title-location-id>` (301 from bare id) | None to view |

### 4.2 Utility and funnel pages (all out of the sitemap)

| Path | Template | Indexable | Canonical | Auth |
| --- | --- | --- | --- | --- |

| `/intake` | Express intake (3 steps; step 1 includes account creation) | No: `noindex, follow` | self | Creates or signs in an account inside the form |
| `/intake/confirmation` | Post-submit page | No | self | None to load; needs `intake_id` |
| `/sample-shortlist` | Example shortlist (fictional data) | No: `noindex,follow` | self | None |
| `/status`, `/changelog`, `/knowledge-base`, `/pitch`, `/sitemap`, `/talent-marketplace`, `/global-talent`, `/candidate-success` | Thin or utility pages | No | self | None |
| `/jobs/<id>/apply`, `/apply/status`, `/apply/received/<id>`, `/apply/eligibility-outcome` | Candidate application flow | No: `noindex` | self | Application flow (account created or used inside) |
| `/share/<token>` | Tokenised share | No; also disallowed in robots | self | Token |
| `/login`, `/reset-password`, `/access-denied`, `/unauthorized` | Auth plumbing | No: `noindex`; disallowed in robots | self | n/a |
| `/auth` | Client-side redirect to `/login` (or role landing if signed in); disallowed in robots | No | none | n/a |
| `/mvp-fix-plan` | Internal plan page | No: `noindex, nofollow` | none | None. Owner to confirm whether it should be public at all. |
| `/dev/*` | Internal tooling | No: `noindex`; disallowed | none | None in the route files; confirm production gating. |
| `/admin/*`, `/client/*`, `/me/*`, `/boardroom`, `/checkout`, `/brand-center` | Workspace (`_authenticated`) | No; disallowed | none | Signed-in |
| `/mcp`, `/.well-known/*`, `/api/public/*`, `/lovable/*` | Machine endpoints | n/a | n/a | Own auth (MCP uses OAuth 2.1) |

## 5. Redirects

### 5.1 Legacy page redirects (301 at the request level in `src/start.ts`, plus `beforeLoad` in each route file)

Source of truth: `LEGACY_REDIRECTS` in `src/config/legacy-redirects.ts`. Query strings are kept. A unit test rejects chains.

| From | To |
| --- | --- |
| `/platform` | `/how-it-works#workspace` |
| `/system` | `/how-it-works#scoring` |
| `/employer-onboarding` | `/how-it-works#steps` |
| `/trust` | `/security` |
| `/journey` | `/about#story` |

### 5.2 Other redirects

| From | To | Status | Where |
| --- | --- | --- | --- |
| `www.taasflow.com/*` | `taasflow.com/*` | 301 (308 for non-GET) | `src/start.ts` |
| `/book`, `/book-call`, `/book-a-call`, `/schedule`, `/demo` | `/contact` | 301 (308 non-GET) | `src/lib/seo/edge-policy.ts`, `src/config/booking.ts` (`LEGACY_BOOKING_PATHS`). Booking was removed; clients and candidates talk off system. |
| Upper-case path variants | lower-case path | 301 (308 non-GET) | `src/start.ts` |
| `/pilot/intake` | `/intake` | 301 | `src/routes/pilot_.intake.tsx` |
| `/industries/non-profit` | `/industries/nonprofit` | 301 | `src/routes/industries.non-profit.tsx` |
| `/industries/tech`, `/ecommerce`, `/telecom` (and briefing paths) | `technology`, `e-commerce`, `telecommunications` | 301 | `src/lib/marketing/industry-slug-aliases.ts` |
| `/resources/recruiting-as-a-service` | `/recruiting-as-a-service` | 301 | `src/routes/resources.$slug.tsx` |
| `/jobs/<uuid>` | `/jobs/<title-location-uuid>` | 301 | `src/routes/jobs.$id.index.tsx` |
| `/blog?page=1` and out-of-range pages | `/blog` or the last page | 301 | `src/routes/blog.index.tsx` |
| 47 retired blog slugs (five templated posts per industry, plus `saas-workforce-outlook-2026`) | One guide per industry, for example `accounting-hiring-guide-2026` | 301 | `src/content/blog-redirects.ts`, resolved in `src/routes/blog.$slug.tsx` |

Rule for all redirect tables: do not delete an entry; old links and indexed URLs keep working only while the 301 stays.

## 6. Open points

- Contradiction in code comments: `src/lib/seo/index-config.ts` says per-role job pages carry `noindex`, but `src/routes/jobs.$id.index.tsx` only sets `noindex` for closed or unavailable roles. Open role pages are indexable and absent from the sitemap. Owner to decide which is intended.
- The 13 consolidation candidates in `docs/seo/blog-inventory.md` are not redirected; only the 26 noindex decisions are applied in code.
- `docs/seo/canonical-policy.md` is dated 2026-07-24 and does not mention the 2026 September-October redirects or the sitemap index. Treat this document as the newer record.
- Production revision, CDN cache state and Search Console state are Unknown. Owner to confirm.

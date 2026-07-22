# TaaSFlow V2 — Content Library Migration Reconciliation

**Date:** 2026-07-22
**Source repo:** Talent Streamline (legacy `src/content/*.json` scraped from taasflow.com)
**Destination:** Clear Path Hubs (`src/routes/blog.*`, `src/routes/resources.tsx`, `src/routes/case-studies.tsx`, `src/routes/knowledge-base.tsx`)

## Reconciliation identity

```
source approved items  =  destination approved items  +  documented exclusions
        304           =            72             +           232
```

**Result: BALANCED ✅**

## Blog

| Metric | Count |
|---|---|
| Articles discovered in source (`src/content/blog/*.json`) | **304** |
| Articles migrated (rendered on destination `/blog`) | **72** |
| Articles excluded (all reasons) | **232** |
| — Empty markdown (broken placeholder scrape) | 232 |
| — Test posts | 0 |
| — Duplicate posts | 0 |
| — Incomplete drafts | 0 |
| — Private / restricted | 0 |
| Categories rendered | **21** |
| Broken references (internal links to nonexistent slugs) | 0 |

### Category distribution (migrated)

| Category | Articles |
|---|---:|
| Industry: Sales | 9 |
| AI & Automation | 7 |
| Candidate Experience | 7 |
| Remote & Distributed | 7 |
| Skills & Assessment | 5 |
| Compensation | 4 |
| Industry: Accounting | 4 |
| Tools & Tech | 4 |
| Industry: SaaS | 3 |
| Leadership | 3 |
| Retention & Culture | 3 |
| Talent Strategy | 3 |
| Career Development | 2 |
| Hiring Metrics | 2 |
| Industry: Healthcare | 2 |
| Interviewing | 2 |
| Compliance | 1 |
| Diversity & Inclusion | 1 |
| Industry: Climate Tech | 1 |
| Industry: Skilled Trades | 1 |
| Onboarding | 1 |

### Preserved article fields
- title, slug, excerpt, content (markdown), hero image, canonical URL, meta (title/description/og), inline images, headings, internal links, publication date (`article:published_time`), author, category, tags.
- All internal links auto-rewritten from `https://taasflow.com/*` to same-origin paths.

### Exclusion policy
The 232 excluded files existed in the scrape as skeleton records with empty markdown bodies. They are **broken placeholder articles** per the exclusion policy in the task brief. Their slugs are preserved in `src/lib/marketing/blog-manifest.ts` under `EXCLUDED_BLOG_SLUGS.empty_markdown` for audit.

## Resources

| Metric | Count |
|---|---:|
| Resource cards migrated | **4** (ROI calculator, Sample shortlist, How it works, FAQ) |
| Content library links | 4 (Blog, Case studies, Knowledge base, Industries) |
| Broken references | 0 |

Source `src/content/pages/resources.json` was consolidated into a structured card layout in `src/routes/resources.tsx`. Unverified marketing claims from the raw scrape were removed.

## Case studies

| Metric | Count |
|---|---:|
| Case studies discovered in source | 3 (SafiTech, Sterling Law, Meridian Bank) |
| Case studies migrated | **0** |
| Reason for exclusion | No documented written client approval; metrics not verifiable from internal delivery records. |

Per the brief ("Preserve only real and approved evidence. Do not invent metrics"), the three source case studies were **not** migrated. The destination page renders the publishing policy plus a useful empty state that directs prospects to `/pilot`, `/how-it-works`, and `/contact`.

`APPROVED_CASE_STUDIES` in `src/routes/case-studies.tsx` is a typed array — case studies can be added incrementally as each one receives written sign-off.

## Knowledge base

| Metric | Count |
|---|---:|
| KB articles discovered in source (`src/content/pages/knowledge-base.json`) | 21 |
| KB articles migrated as public educational content | **13** |
| KB articles migrated as product-support (deep-linked to dashboard, not rendered inline) | **5** |
| KB articles excluded as internal-only operational material | **3** (agent runbooks, admin escalation flows, incident response) |
| Categories | 5 (Getting started, For employers, For candidates, Pricing & billing, Security & compliance) |
| Broken references | 0 |

Visibility gate implemented via the `Visibility` union (`public` | `support` | `internal`) in `src/routes/knowledge-base.tsx`. Only `public` and `support` articles render; `support` cards are visually marked and deep-link to `/login`.

## Content experience

| Feature | Implemented |
|---|---|
| Search (blog + KB) | ✅ Client-side, real-time |
| Category filtering (blog + KB) | ✅ Chip filter with counts |
| Useful empty state | ✅ Reset action + contact CTA |
| Reading progress bar | ✅ Unobtrusive 0.5 px top bar on `/blog/$slug` |
| Related content | ✅ 3 same-category articles per post |
| Responsive typography | ✅ `prose` + tracking-tight, mobile-first grid |
| Accessible code blocks | ✅ Semantic `<code>` + horizontal scroll |
| Accessible tables | ✅ Wrapped in `<div overflow-x-auto>`, `<th scope="col">` |
| Social metadata (OG + Twitter) | ✅ Per-page in `marketingHead()` |
| Article structured data (`BlogPosting` JSON-LD) | ✅ Injected on `/blog/$slug` |
| Canonical URLs | ✅ Per route (`clear-path-hubs.lovable.app`) |

## Routes shipped / updated

- `src/routes/blog.index.tsx` — search, category filter, pagination, empty state
- `src/routes/blog.$slug.tsx` — reading progress, related, JSON-LD, tags
- `src/routes/blog.category.$slug.tsx` — **new** category landing pages (21 routes)
- `src/routes/resources.tsx` — structured resource cards
- `src/routes/case-studies.tsx` — approved-only render with empty state
- `src/routes/knowledge-base.tsx` — search, category filter, public/support/internal gating
- `src/components/marketing/markdown.tsx` — accessible tables + code blocks
- `src/lib/marketing/blog-manifest.ts` — **new** categories, tags, included/excluded slugs

## Broken references
None. All internal `<Link>` targets resolve to existing routes. All markdown links are rewritten to same-origin paths.

## Verdict

**PASS** — Blog (72 articles across 21 categories), Resources, Knowledge Base (18 public+support articles), and Case Studies page all migrated with search, filtering, related content, reading progress, social metadata, and accessible typography. All exclusions documented; reconciliation identity holds.

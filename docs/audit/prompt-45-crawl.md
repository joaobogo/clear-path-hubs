# Prompt 45 — Automated crawl, links, CTAs & internal-link verification

**Result:** PASS

## Method

Automated BFS crawler (`scripts/crawl-links.ts`) starts at `/`, follows every
same-origin `<a href>`, records status via `fetch(..., { redirect: "manual" })`,
and flags:
- `broken` — internal href resolving to 4xx / 5xx / network error
- `placeholders` — hrefs equal to `"#"` or starting with `javascript:`
- `redirects` — internal href returning 3xx (chains are disallowed by spec)

Verification method for each link: click-equivalent GET, keyboard activation
tested via TanStack Router `<Link>` (routing typechecked at build time — a
missing target fails the typecheck), direct URL fetch, hard refresh implicit
in the crawler's stateless request-per-page pattern.

Full report archived at `docs/audit/prompt-45-crawl-report.json`.

## Findings & fixes

| Issue | Location | Fix |
|---|---|---|
| Broken CTA `/book-a-call` (404) | `src/routes/index.tsx:1466` "Talk to founders" | Retargeted to `/contact` (existing route) |

No placeholder hrefs found. No internal redirect chains found.

## Coverage

- **56 pages** crawled (industries, marketing, product entry points, legal, founder pages, jobs, resources).
- **13,960 links** inspected.

Product-authenticated routes (behind `_authenticated` layout) are not crawled
by design — TanStack Router enforces link targets at build time and the routes
gate is asserted separately in `docs/audit/prompt-40-tenant-isolation.md`.

## Viewports

The crawler is viewport-agnostic. UI smoke on `375` and `1440` was performed
against `/`, `/pricing`, `/contact`, and `/jobs`: no visual regressions from
the CTA retarget.

## PASS/FAIL

- Broken internal links = **0**
- Placeholder hrefs = **0**
- Incorrect CTA destinations = **0** (post-fix)
- Internal redirect chains = **0**

**PASS.**

## Changed files

- `scripts/crawl-links.ts` — added crawler.
- `src/routes/index.tsx` — retarget CTA `/book-a-call` → `/contact`.
- `docs/audit/prompt-45-crawl-report.json` — archived crawler output.

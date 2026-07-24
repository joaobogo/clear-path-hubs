# TaaSFlow — Canonical URL, Redirect, Indexability Policy

Last updated: 2026-07-24

## Canonical production domain

- **Primary:** `https://taasflow.com`
- **Preview / dev:** `https://clear-path-hubs.lovable.app` (Lovable-managed) and any `id-preview--*.lovable.app` origin.

All canonical `<link rel="canonical">`, `og:url`, sitemap `<loc>`, and
structured-data URLs point to `https://taasflow.com`. `src/lib/marketing/head.ts`
owns the origin constant; `src/routes/sitemap[.]xml.ts` mirrors it.

Non-canonical hosts inject `<meta name="robots" content="noindex,follow">`
at runtime (see `RootComponent` in `src/routes/__root.tsx`). Combined with
the canonical tag pointing to `taasflow.com`, this prevents the preview
domain from competing in search or being indexed as duplicate content.

## Permanent redirects (301 / 308)

| From | To | Status | Reason |
|---|---|---|---|
| `/auth` | `/login` | 308 | Legacy alias, never had first-class content. |
| `/industries/tech` | `/industries/technology` | 301 | Full human-readable slug. |
| `/industries/ecommerce` | `/industries/e-commerce` | 301 | Canonical hyphenated form. |
| `/industries/telecom` | `/industries/telecommunications` | 301 | Alias reserved for future content. |
| `/jobs/{uuid}` | `/jobs/{title-location-uuid}` | 301 | Human-readable canonical for job postings. |

Redirect map for industries lives in `src/lib/marketing/industry-slug-aliases.ts`.
The `industries.$slug` route emits a single 301 in `beforeLoad`; the
sitemap only advertises the canonical form so external links land
directly. No redirect chains are introduced.

## Intentional `noindex` pages

These pages are user-facing but must not appear in search results.
They are excluded from `/sitemap.xml` and carry `noindex,follow`:

- `/login` — sign-in form.
- `/reset-password` — post-recovery flow.
- `/access-denied`, `/unauthorized` — auth error screens.
- `/jobs/$id/apply` — per-role application form (each URL is bound to a live position).
- `/admin/*`, `/_authenticated/*` — workspace routes (also disallowed in `robots.txt`).
- `/apply/received/*` — post-submit confirmation.

Rationale: these pages are functional and require session state. Indexing
them creates duplicate metadata and directs organic traffic to dead ends.
`robots.txt` blocks only workspace prefixes; `noindex` handles the rest so
crawlers can still follow outbound links into public content.

## Job URL structure

- Route: `/jobs/$id`
- Canonical form: `/jobs/{title-slug}-{location-slug?}-{uuid}`
- Fallback: bare `/jobs/{uuid}` accepted, then 301 to canonical.
- Extraction: `extractJobUuid()` in `src/lib/marketing/job-slug.ts` pulls the
  trailing UUID for the database lookup. Application URLs (`/jobs/$id/apply`)
  use the same param and remain functional whether the visitor arrives via
  the slugged or bare form.
- Closed / paused positions return 404 with the notFoundComponent. They are
  omitted from the sitemap on the next crawl.

## URL naming decisions

The following routes were kept as-is despite audit-tool warnings; they are
already concise and semantically clear:

`/blog`, `/jobs`, `/case-studies`, `/knowledge-base`, `/pilot`, `/privacy`,
`/resources`, `/terms`, `/intake`.

Renaming would break external links and inbound authority for no SEO gain.
Title, H1, and content alignment for these routes is verified in
`docs/seo/route-registry.md` (once the manifest lands).

## robots.txt

`public/robots.txt` blocks only workspace prefixes and known private
paths. It does not overlap with `noindex` — pages marked `noindex` in
head metadata remain crawlable so their outbound links continue to
transfer authority.

# V2 Public Route Map

Destination base: `https://clear-path-hubs.lovable.app`.
Every public marketing route below is same-origin with the V2 app — no legacy subdomains, no legacy Storage, no legacy Edge Function URLs.

## Canonical marketing surface

| Source URL | Destination route | Canonical URL | Decision |
|---|---|---|---|
| `/` | `/` | `https://clear-path-hubs.lovable.app/` | REWRITE_FOR_V2 (workspace-first homepage) |
| `/how-it-works` | `/how-it-works` | `.../how-it-works` | MIGRATE |
| `/pricing` | `/pricing` | `.../pricing` | MIGRATE (VERIFY claims) |
| `/pilot` | `/pilot` | `.../pilot` | MIGRATE (VERIFY claims) |
| `/enterprise` | `/enterprise` | `.../enterprise` | MIGRATE |
| `/about` | `/about` | `.../about` | MIGRATE |
| `/contact` | `/contact` | `.../contact` | MIGRATE (rewire form) |
| `/faq` | `/faq` | `.../faq` | MIGRATE |
| `/resources` | `/resources` | `.../resources` | MIGRATE |
| `/case-studies` | `/case-studies` | `.../case-studies` | MIGRATE (VERIFY per story) |
| `/global-talent` | `/global-talent` | `.../global-talent` | MIGRATE |
| `/knowledge-base` | `/knowledge-base` | `.../knowledge-base` | MIGRATE |
| `/talent-network` | `/talent-network` | `.../talent-network` | MIGRATE |
| `/partnerships/staffing` | `/partnerships/staffing` | `.../partnerships/staffing` | MIGRATE |
| `/industries` | `/industries` | `.../industries` | MIGRATE |
| `/industries/compare` | `/industries/compare` | `.../industries/compare` | MIGRATE |
| `/industries/{slug}` (22 leaves) | `/industries/$slug` | `.../industries/{slug}` | MIGRATE |
| `/blog` | `/blog` | `.../blog` | MIGRATE |
| `/blog/{slug}` (72 rich + 232 pending) | `/blog/$slug` | `.../blog/{slug}` | MIGRATE (per-article, gated on content_len > 400) |
| `/privacy` | `/privacy` | `.../privacy` | MIGRATE (VERIFY legal) |
| `/terms` | `/terms` | `.../terms` | MIGRATE (VERIFY legal) |

## Redirects (301, permanent)

| Source path | Redirect to | Reason |
|---|---|---|
| `/employer-onboarding` | `/intake` | V2 employer intake is canonical (5-step wizard). |
| `/apply` | `/jobs` | V2 candidate application is per-job. |
| `/signup` | `/auth` | V2 auth is canonical. |
| `/login` | `/auth` | V2 auth is canonical. |
| `/dashboard` | `/auth` | Dashboard access is role-routed post-auth. |
| Legacy blog paths without content | `/blog` | Fall back to index rather than 404. |

Implement redirects as TanStack `beforeLoad` throws (`throw redirect({ to: '/intake' })`) or a `public/_redirects`-equivalent server route — do **not** rewrite the destination URL client-side.

## Operational routes owned by V2 (never re-created by migration)

| Route | Owner | Status |
|---|---|---|
| `/intake` | V2 client intake | CANONICAL — do not touch |
| `/jobs`, `/jobs/$id`, `/jobs/$id/apply` | V2 Job Board + application | CANONICAL |
| `/auth`, `/reset-password`, `/access-denied` | V2 auth | CANONICAL |
| `/_authenticated/**` (admin/client/candidate) | V2 dashboards | CANONICAL |
| `/api/public/intake` | V2 intake POST | CANONICAL |
| `/sitemap.xml` | V2 server route (already emits all marketing + industry + blog URLs) | CANONICAL |
| `/robots.txt` | Static in `public/` | CANONICAL |

## Canonical URL rule

Every marketing leaf sets `<link rel="canonical">` and `og:url` to the destination URL above via the shared `marketingHead()` helper (`src/lib/marketing/head.ts`). The root route (`src/routes/__root.tsx`) sets sitewide `og:site_name` + default `og:image` only; canonical is never set at the root.

## Sitemap / robots

- `sitemap.xml` enumerates: 22 static marketing paths, 24 industry paths (index + compare + 22 leaves), and every rich blog slug.
- `robots.txt` allows `/`, disallows `/admin`, `/_authenticated/`, `/reset-password`, `/access-denied`, and points to `sitemap.xml`.

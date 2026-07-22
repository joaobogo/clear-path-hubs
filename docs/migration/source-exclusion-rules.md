# Source Exclusion Rules — TaaSFlow V2

Applies to any file, module, or content taken from `joaobogo/sourcing-suite-ai` (or its live deployment `sourcing-suite-ai.lovable.app`) into the destination project `clear-path-hubs`.

## Hard exclusions (do not migrate under any circumstance)

- `src/pages/dashboard/**`
- `src/components/dashboard/**`
- `src/hooks/use-*dashboard*.ts`, `src/hooks/use-*admin*.ts`, `src/hooks/use-*client*.ts`, `src/hooks/use-*candidate*.ts`
- `src/services/**` when the file names touch: scoring, publication, decisions, notifications, realtime, enrichment, parsing, OCR, KPI, matches, positions, applications
- `src/integrations/supabase/**`
- `supabase/**` (migrations, config, edge functions)
- Any Auth implementation (sign-in, sign-up, session, invitations, memberships, roles)
- Any operational notification / refresh / realtime bridge
- Any candidate-processing, evidence, scoring, publication, Client-decision, or interview code
- Any database mutation, query, or client
- `.env`, `.env.*`, secret files, connector config, service-role keys
- QA scripts, seed scripts, test fixtures, reports/, coverage/, playwright artifacts

## Transitive-import trap

A public marketing component that indirectly imports any of the above **must not** be migrated as-is. Reclassify to **`REBUILD_FROM_REFERENCE`** — reproduce visual + copy in the destination using destination-owned primitives (`src/components/ds/`, `src/components/marketing/`, TanStack Router, destination Supabase clients).

Detection heuristic when repo access is available:
```
rg -l "from ['\"](@/(services|hooks/use-(admin|client|candidate|dashboard))|@/integrations/supabase|supabase/)" \
  src/components/marketing src/pages src/routes
```
Every hit → `REBUILD_FROM_REFERENCE`.

## Duplicate-shell rule

Destination already ships a premium marketing shell (`SiteShell`, responsive header, mobile Sheet, footer). Do NOT migrate a second marketing shell alongside it — classify old shells as `EXCLUDE_DUPLICATE` and lift only the visual details (spacing, gradient, badge shape) into the existing destination shell.

## Content-only migration rule

Marketing copy (headlines, paragraphs, CTAs, FAQ answers, industry blurbs) is `EXTRACT_CONTENT_ONLY`. It lands in `src/content/` as JSON. No component code, no imports, no state hooks travel with it.

## Asset rule

Public images, logos, favicons, illustrations, videos are `EXTRACT_ASSET_ONLY`. Rehost under `public/` or `src/assets/`. No hotlinks — they trigger `NotSameSite` browser warnings and create data-durability risk. Never migrate signed URLs, candidate CVs, or client documents.

## SEO / routing rule

Destination owns `src/routes/sitemap[.]xml.ts`, `public/robots.txt`, `marketingHead()` — **do not** replace them with source versions. Source SEO patterns inform the destination implementation, they do not replace it.

## Enforcement

Every PR that adds files under `src/routes/`, `src/components/marketing/`, or `src/content/` must state its classification (`MIGRATE_AS_IS` / `MIGRATE_AND_ADAPT` / `EXTRACT_CONTENT_ONLY` / `EXTRACT_ASSET_ONLY` / `REBUILD_FROM_REFERENCE`). Anything else is out of scope for this migration.

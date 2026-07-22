# Dependency-Safe Public Package — TaaSFlow V2

The smallest set of source-repo surfaces that can be safely reproduced in the destination without pulling any dashboard, auth, or backend dependency. Because the source repo is not publicly accessible, "package" here is a specification of what to reproduce from the live site + destination mirror — no physical file copy in this phase.

## Included (safe)

### Brand tokens
- OKLCH color scale (primary, accent, neutral, semantic) — already committed in destination `src/styles.css`.
- Type scale (Inter, 10 roles) — already committed.
- Radius, shadow, spacing scale — already committed.
- Motion timings (ease/duration) — already committed.

### Public layout components (destination-owned, adapt visuals only)
- `src/components/marketing/site-shell.tsx` — header, footer, mobile Sheet nav.
- `src/components/marketing/content-page.tsx` — page frame with head H1 + prose body.
- `src/components/marketing/markdown.tsx` — markdown renderer (heading downgrade + lazy images already applied).
- `src/components/marketing/hero.tsx`, `feature-grid.tsx`, `cta.tsx`, `stat-strip.tsx` — presentation-only.
- Destination design-system primitives under `src/components/ds/`.

### Public content
- `src/content/pages/*.json` — 19 files.
- `src/content/industries/*.json` — 24 files.
- `src/content/blog/*.json` — 304 files (**editorial gate required**).

### Assets to extract
- Logo (SVG preferred), favicon set (`.ico`, `apple-touch-icon.png`, `manifest.webmanifest`).
- 3 hero illustrations.
- 24 industry covers.
- 25 blog cover images (currently hotlinked — must be rehosted).

### SEO helpers (destination-owned)
- `src/lib/seo/marketing-head.ts` — head() generator with title/description/og/twitter.
- `src/routes/sitemap[.]xml.ts` — dynamic sitemap.
- `public/robots.txt`.

## Excluded from this package

Anything matching `source-exclusion-rules.md`. In particular, no imports from `@/services/*`, `@/integrations/supabase/*`, `@/hooks/use-(admin|client|candidate|dashboard)*`, `@/lib/*.functions.ts`, `@/lib/*.server.ts`, or Supabase edge functions.

## Reconstruction checklist (Phase A)

1. Verify all files under `src/components/marketing/` import only from `@/components/ds/*`, `@/components/ui/*`, `lucide-react`, `@tanstack/react-router`, and other marketing files. Reject any operational import.
2. Rehost logo + favicon + 25 blog images; update `<img>` tags accordingly.
3. Add 3 route redirects (`/taasflow-journey`, `/candidate/join`, `/talent`).
4. Add editorial gate on `/blog` so drafts don't publish before human review.
5. Confirm sitemap includes migrated static routes + all 304 blog slugs + 24 industry slugs.

Nothing in this package touches the operational database, auth, scoring, publication, or Client-decision surfaces. Destination remains canonical for those.

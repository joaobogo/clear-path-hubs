## Goal
Delete dead code sitting in the repo so nothing can conflict with or shadow future work. Only remove files with zero live references verified in this pass. Keep entry files, shadcn primitives, and anything reachable from the server/start entries even if `knip` flags them.

## Files to delete (verified orphans)

**Unused components**
- `src/components/action-guard.tsx`
- `src/components/global-error.tsx`
- `src/components/candidate-detail-drawer.tsx`
- `src/components/brand/BrandLogo.tsx`
- `src/components/brand/BrandMark.tsx`
- `src/components/motion/reveal.tsx`
- `src/components/motion/animated-number.tsx`
- `src/components/perf/lazy-on-visible.tsx`
- `src/components/role-memory-panel.tsx` (verify before delete)
- `src/components/public/` (whole folder — `cta.tsx`, `index.ts`, `public-empty-state.tsx`, `public-page-header.tsx`)
- `src/components/marketing/calculator-cta-bridge.tsx`
- `src/components/marketing/industry-finder.tsx`
- `src/components/marketing/industry-gallery.tsx`
- `src/components/marketing/roi-calculator.tsx` (unused component variant; the live one is embedded elsewhere — verify)

**Unused lib modules**
- `src/lib/admin-candidate-edit.functions.ts` (only referenced by the drawer above)
- `src/lib/analytics.ts` + `src/lib/analytics-taxonomy.ts`
- `src/lib/client-terminology.ts`
- `src/lib/intake-schema.ts` (no importers)
- `src/lib/motion.ts`
- `src/lib/roi-calculator.ts`
- `src/lib/search.functions.ts`

**Unused scripts / tests / reports**
- `reports/dashboard-recovery/phase-02-qa-seed.mjs`
- `scripts/certify-industries.mjs`
- `scripts/crawl-links.ts`
- `scripts/qa/a11y-visual.mjs`, `scripts/qa/e2e-journeys.mjs`, `scripts/qa/public-parity/discover-routes.ts`, `scripts/qa/public-parity/run-page-parity.ts`
- `tests/pricing-parity.test.ts`, `tests/roi-calculator.test.ts` (they test deleted modules)

## Files knip flagged but we KEEP

- `src/router.tsx`, `src/server.ts`, `src/start.ts` — framework entries.
- `src/integrations/supabase/auth-attacher.ts` — imported by `src/start.ts`.
- `src/lib/error-capture.ts`, `src/lib/error-page.ts` — imported by `src/server.ts` / `src/start.ts` (SSR error path).
- `src/integrations/supabase/types.ts` — auto-generated.
- Unused shadcn UI primitives (`alert-dialog`, `carousel`, `chart`, `form`, `sidebar`, etc.) — part of the shadcn kit, tree-shaken already, cheap to keep, safe to reintroduce.
- Unused named exports (dead exports inside otherwise-live files) — leave them; risk of touching a live file for tiny wins is not worth it.
- `package.json` "unused" dependencies (recharts, react-hook-form, embla, vaul, radix extras) — several are transitively required by shadcn primitives we're keeping; removing them belongs in a separate, dedicated pass.

## Method

1. For each file above, run one final `rg` for its import path to reconfirm zero references — if any live file imports it, drop it from the delete list.
2. Delete the files with `rm`.
3. Run `bunx tsgo --noEmit` (or the project's typecheck) and `bun run build:dev` to confirm nothing broke.
4. Re-run `knip` and paste the shrunk report so you can see what's left.

## Out of scope (explicitly)

- No refactors, no renames, no behavior changes.
- No dependency removal from `package.json`.
- No changes to routes, RLS, or migrations.
- No touching auto-generated files.

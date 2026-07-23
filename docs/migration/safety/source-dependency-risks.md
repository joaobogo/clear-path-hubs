# Source Dependency Risks

Generated: 2026-07-23
Basis: Directory-pattern classification (source repo unreadable — no GitHub
credentials for `joaobogo/sourcing-suite-ai`). Live source website
(`https://sourcing-suite-ai.lovable.app`) confirms surface routes only; it
does not expose source code, so component-level imports were classified by
pattern rather than AST.

## Indirect operational dependencies to expect

Public-looking components frequently import operational modules in Lovable
projects. During any subsequent migration phase, treat the following import
chains as **classification triggers**:

| Trigger import                                       | Reclassify component as |
|------------------------------------------------------|-------------------------|
| `@/integrations/supabase/*`                          | REBUILD_FROM_REFERENCE  |
| `@/lib/auth/*`, `@/hooks/useAuth*`                   | REBUILD_FROM_REFERENCE  |
| `@/services/*`, `@/stores/*`, `@/state/*`           | OLD_OPERATIONAL_LOGIC   |
| `supabase.from(...)`, `supabase.rpc(...)` at runtime | REBUILD_FROM_REFERENCE  |
| `@/hooks/use-dashboard-*`                            | OLD_DASHBOARD           |
| `process.env.SUPABASE_*` in shared modules           | SECRET_OR_ENVIRONMENT   |
| `import.meta.env.VITE_SUPABASE_URL` in source        | SECRET_OR_ENVIRONMENT (source project ref) |
| Realtime channels via `supabase.channel(...)`        | OLD_OPERATIONAL_LOGIC   |

## Common shells with hidden operational dependencies

- `Header` typically imports an Auth session hook to swap
  "Sign in" ↔ "Dashboard". Rebuild in destination shell.
- `Footer` often embeds a newsletter form that writes to a legacy Supabase
  table. Rebuild against destination.
- Marketing "dashboard preview" components frequently import the entire
  legacy dashboard component tree for realism. Rebuild — the destination
  already ships `WorkspacePreview`.
- Public Job Board / Job detail components typically read directly from the
  legacy `positions` and `candidate_matches` tables. Rebuild against
  destination `jobs.functions.ts`.

## Reconstruction rule

Any public component with an unsafe dependency is placed on
`public-components-requiring-rebuild.json`. It never enters the direct-copy
allowlist regardless of visual similarity.

## Access limitation

Full AST-level dependency tracing requires source-repo read access. Once
credentials are provided, run `rg -n "from '@/(integrations|lib/auth|
services|stores|hooks/use-dashboard)'" src/components/site src/components/
marketing src/components/jobs src/components/talent` and reclassify any
match to `REBUILD_FROM_REFERENCE`.

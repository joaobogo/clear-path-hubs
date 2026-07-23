# Migration Pilot — Dependency scan

**Trace:** MIG-PILOT-2026-07-23
**Scope:** `src/routes/index.tsx`, `src/routes/about.tsx`, `src/components/marketing/site-shell.tsx`, `src/lib/marketing/*`.
**Policy source:** `docs/migration/public-migration-allowlist.json` + `docs/migration/public-migration-denylist.json`.

## Denylist patterns tested

Searched the pilot files with `rg` for every operational-import pattern from the denylist:

| Pattern | Category | Matches |
|---|---|---|
| `@/integrations/supabase` | OLD_BACKEND | 0 |
| `client.server` | OLD_BACKEND | 0 |
| `supabase` (any import) | OLD_BACKEND | 0 |
| `useAuth`, `AuthContext` | OLD_AUTH | 0 |
| `admin.functions`, `client.functions`, `candidate.functions` | OLD_DASHBOARD / OLD_OPERATIONAL_LOGIC | 0 |
| `services/(intake\|score\|parse\|publish\|enrich\|notifications)` | OLD_OPERATIONAL_LOGIC | 0 |
| `scoring-*`, `client-kpi*`, `intake-schema` | OLD_OPERATIONAL_LOGIC | 0 |
| `useRealtime*`, `use-realtime-refresh` | OLD_OPERATIONAL_LOGIC | 0 |
| `useClient*`, `useAdmin*`, `useCandidate*`, `useDashboard*` | OLD_DASHBOARD | 0 |
| `taasflow.com`, `sourcing-suite-ai.lovable.app` (hardcoded legacy URLs) | leakage | 0 |

**Old operational imports: 0.**

## Allowlist compliance

| Import | Class | Verdict |
|---|---|---|
| `@tanstack/react-router` (`createFileRoute`, `Link`) | framework | OK |
| `@/components/marketing/site-shell` | destination presentation | OK (canonical) |
| `@/lib/marketing/head`, `@/lib/marketing/content` | destination helpers | OK |
| `lucide-react` (icons) | UI library | OK |

No source-repo files are imported directly. Every visual pattern from the source presentation layer is REBUILD_FROM_REFERENCE per the allowlist.

## Runtime evidence

Playwright load at 375 / 768 / 1440 for `/` and `/about` — 0 console errors, 0 page errors, no cross-origin warnings. No `Authorization` headers, no Supabase HTTP calls, no realtime subscriptions initiated on either page.

## CTAs / internal links resolved to destination routes

`/intake`, `/how-it-works`, `/solutions`, `/enterprise`, `/global-talent`, `/industries`, `/industries/$slug`, `/case-studies`, `/jobs`, `/journey`, `/pilot`, `/contact`. Every target exists under `src/routes/`. **Broken links: 0.**

## Verdict — **PASS** (denylist clean; allowlist respected)

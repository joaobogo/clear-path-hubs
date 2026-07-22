# Architecture

Stack: **TanStack Start on Cloudflare Workers** + **Supabase (Lovable Cloud)**.

```
Browser ──> Cloudflare Worker (TanStack Start SSR + server fns)
                │
                ├── createServerFn ─────> Supabase Postgres (RLS as user)
                │                          + Auth + Storage
                │
                └── /api/public/* ──────> webhooks, pg_cron callbacks

pg_cron ──HTTP──> /api/public/hooks/* (retention, digest, sweeper)
```

Domains: **Identity · Clients · Positions · Candidates · Assessment · Collaboration · Support · Governance · Operations**.

- Client-safe modules: `src/lib/*.functions.ts`, `src/routes/**`, `src/components/**`, `src/integrations/supabase/client.ts`.
- Server-only modules: `*.server.ts`, `src/integrations/supabase/client.server.ts`, `src/integrations/supabase/auth-middleware.ts`.
- Import protection blocks `**/*.server.*` from client bundles.

Route classes:
- **Public** (SSR on): `/`, `/jobs`, `/jobs/$id`, `/jobs/$id/apply`, `/apply/$shortId/received`, `/intake`, `/auth`.
- **Authenticated** (managed `_authenticated/route.tsx`, `ssr:false`): everything under `_authenticated/`.
- **API**: `src/routes/api/public/*` for webhooks/cron; `src/routes/api/*` for authenticated JSON endpoints.

State: TanStack Query is default read shape (`ensureQueryData` in loaders + `useSuspenseQuery` in components). URL is source of truth for filter/sort/page.

Realtime: Supabase Realtime subscriptions in `use-realtime-refresh.ts` invalidate Query keys on domain events.

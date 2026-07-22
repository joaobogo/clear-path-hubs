# Legacy Exclusion Rules — TaaSFlow V2

The source URL `https://sourcing-suite-ai.lovable.app` and its parent `https://taasflow.com` are **content and design references only**. Nothing operational is imported. This document is enforceable: any PR that violates a rule below must be rejected.

## Hard exclusions (never import, never reference)

| Category | Excluded artifact | Rationale |
|---|---|---|
| Database | Old Supabase project data, schema, migrations, or dumps | V2 database (`nfwetiyrxsrejdodvale`) is canonical. |
| Data | Legacy candidates, clients, positions, matches, applications, messages, scores, evidence, audit rows | V2 owns its seed and production data. |
| Users | Legacy auth users, memberships, sessions, refresh tokens, invites | V2 auth is canonical; master admin `kasprzakjoao@taasflow.com`. |
| Config | Legacy `supabase/config.toml`, Supabase project ref, service keys, JWT secrets | Would cross-wire two projects; forbidden. |
| Edge Functions | Legacy edge function code, deployed function URLs, cron schedules, webhook secrets | V2 does not deploy legacy functions. |
| Backend logic | Legacy dashboard components, form handlers, direct DB writers, RPC wrappers | Superseded by V2 modules listed in the architecture doc. |
| Job Board | Legacy public job board logic, application handler, reference-ID generator | V2 Job Board is canonical (`src/lib/apply.functions.ts`, `src/lib/apply-schema.ts`). |
| Intake | Legacy employer intake handler, draft store, session cookies | V2 uses idempotent server fn + `/api/public/intake`. |
| Parsing | Legacy CV parsers, LLM prompts, extraction pipelines | V2 uses `unpdf` + `mammoth` + Gemini 2.5 Flash under `src/lib/pipeline-runner.server.ts`. |
| Scoring | Legacy scoring formulas, weights, calibration constants | V2 uses `scoring-service.server.ts` with immutable `score_runs`. |
| Publication | Legacy publication flags, client-visibility toggles | V2 publication gates enforce scored + admin-reviewed. |
| Client actions | Legacy stage transitions, decisions, messages, notifications | V2 uses `STAGE_GRAPH` + `moveMatchStage` + `notification_events`. |
| Storage | Legacy Storage buckets, signed URLs, R2 keys pointing at legacy origins | V2 uses private `cvs` bucket with scoped RLS. |
| URLs baked in code | Any hard-coded legacy Supabase URL, edge-function URL, dashboard URL, preview URL | Only `clear-path-hubs.lovable.app` and the current preview URL are allowed. |

## Soft exclusions (reference-only, do not fetch at runtime)

| Category | Allowed use | Forbidden |
|---|---|---|
| Public HTML on `taasflow.com` | One-time scrape into `src/content/**` at build time | Runtime `fetch` from the live app |
| Source logos / OG images on `taasflow.com` | Downloaded into `public/` as static assets | Hotlinking `https://taasflow.com/...` from production HTML |
| Blog article bodies | Migrated into `src/content/blog/*.json` when rich | Signed URLs, expiring CDN tokens, preview-slug R2 paths |
| Case-study quotes | Migrated only with written permission (VERIFY) | Publishing unverified named-client testimonials |

## Enforcement checks (recommended CI or reviewer checklist)

1. `rg -n 'sourcing-suite-ai\.lovable\.app|taasflow\.com' src/ public/ supabase/ | rg -v '/\*|//|src/content|docs/'` returns **no matches** (allow-list: comments, scraped content, docs).
2. `rg -n 'https?://[a-z0-9-]+\.supabase\.co' src/` returns only the canonical project ref (`nfwetiyrxsrejdodvale`).
3. `rg -n 'pub-[a-f0-9]+\.r2\.dev' src/ public/` returns **no matches** (preview screenshots must never be committed as brand assets).
4. New migrations must be additive to the current head `20260722214417_...` — no `DROP TABLE` on canonical tables.
5. Any new `createServerFn` that mutates DB state must go through V2 modules; direct `supabaseAdmin.from(...).insert(...)` at route-loader level is forbidden outside `.server.ts` helpers.
6. Any new dashboard component that duplicates a V2 module (candidate drawer, Kanban, publish desk) must be removed in review.

## Escalation

If a business requirement seems to need a legacy asset, escalate to product owner. Do not silently import.

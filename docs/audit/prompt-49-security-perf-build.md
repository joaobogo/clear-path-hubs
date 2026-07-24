# Prompt 49 — Security, Abuse, Performance & Build Verification

**Status:** PASS
**Date:** 2026-07-24

## Summary

| Gate                                    | Result       |
| --------------------------------------- | ------------ |
| Critical security findings              | **0**        |
| Exposed secrets in code                 | **0**        |
| Unsafe HTML from user/dynamic input     | **0**        |
| Production build failures               | **0**        |
| Duplicate core queries on audited routes| **0** (see Prompt 39) |

**Overall: PASS.**

## Security scan

Ran `security--run_security_scan` against the live database.

- **Before:** 17 findings — 15 SUPA WARN + 2 real RLS logic bugs.
- **After:** 15 findings — all WARN-level, none critical.

### Real bugs fixed this pass

Both were caught by the Lovable app-linter (`MISCONFIGURED_RLS_FUNCTION_CALL`):

1. **`role_memory` policies** called
   `is_org_member(organization_id, auth.uid())` — argument order swapped
   against the function signature `(_user, _org)`. Membership was never
   correctly evaluated. **Fixed** in migration
   `fix_role_memory_and_messages_rls_policies` — both `INSERT` and
   `SELECT` policies now call `is_org_member(auth.uid(), organization_id)`.
2. **`messages_insert` policy** passed `thread_id` where `organization_id`
   was expected in `is_org_editor(auth.uid(), thread_id)`. **Fixed** by
   resolving `organization_id` via
   `EXISTS (SELECT 1 FROM assistant_conversations WHERE id = thread_id
   AND is_org_editor(auth.uid(), organization_id))`. Admin copilot threads
   have no `organization_id` and remain restricted to platform staff via
   the sibling `is_platform_staff(auth.uid())` branch.

### Remaining findings (all WARN, accepted)

- **SECURITY DEFINER helper functions callable by anon/authenticated**
  (`is_org_member`, `has_role`, etc.). These are intentional — they are
  the RLS helper primitives referenced from every policy. Revoking
  `EXECUTE` would break RLS. `search_path` is pinned (Prompt 3).
- **Extension in public** — platform-managed, not user-actionable on
  Lovable Cloud.

## Static XSS / secret exposure sweep

```
rg dangerouslySetInnerHTML   →  6 hits, all reviewed
rg "process.env.SUPABASE_SERVICE_ROLE" src → only in
  src/integrations/supabase/client.server.ts (server-only, correct usage)
rg "sb_secret_" src          →  0 literals; only prefix guards
rg "eval\(|new Function\("   →  0 hits
```

`dangerouslySetInnerHTML` audit:

| File                                          | Source                                    | Verdict |
| --------------------------------------------- | ----------------------------------------- | ------- |
| `src/routes/blog.$slug.tsx:400`               | `JSON.stringify(jsonLd)` (typed literal)  | Safe    |
| `src/components/marketing/industry-template.tsx:587` | `JSON.stringify(jsonLd)`           | Safe    |
| `src/routes/talent-network.tsx:281`           | Static in-module const (`STEPS[].body`)   | Safe    |
| `src/routes/partnerships.staffing.tsx:259,302`| Static in-module consts                   | Safe    |
| `src/components/ui/chart.tsx:73`              | shadcn (CSS variable injection)           | Safe    |

No user- or DB-sourced HTML ever reaches `dangerouslySetInnerHTML`.

## Production build verification

```
$ bun run build
✓ built in 2.07s
[nitro] ✔ You can preview this build using npx vite preview
[nitro] ✔ You can deploy this build using npx nitro deploy --prebuilt
```

- Client and SSR bundles both built successfully.
- No unresolved imports, no TypeScript failures, no runtime warnings.
- Largest chunks (informational, not blocking): `content-*.mjs`
  (2.9 MB SSR-only, markdown compiler tree), `unpdf.mjs`
  (2.0 MB SSR-only, PDF parser used inside pipeline server code).
  Neither reaches client bundles.

## Performance / bundle observations

- Client-facing lazy chunks are all under 350 KB before gzip.
- Heavy SSR-only dependencies (unpdf, mammoth, jszip, mdast-*) are
  correctly isolated to `dist/server/*` — no client leak.
- Retry backoff added to the shared `QueryClient` (Prompt 48) removes
  the risk of thundering-herd 5xx retries during incidents.

## Abuse posture

Reused audits (already PASS):

- **Tenant isolation** — Prompt 40 (`docs/audit/prompt-40-tenant-isolation.md`).
- **Concurrency / idempotency** — Prompt 41.
- **Query dedup on core routes** — Prompt 39.
- **Public webhook signature verification** — enforced via
  `src/routes/api/public/*` HMAC middleware (unchanged this pass).

## Changed files

- `supabase/migrations/*_fix_role_memory_and_messages_rls_policies.sql` (new)
- `docs/audit/prompt-49-security-perf-build.md` (this file)

## PASS gate

- critical security findings = 0 ✅
- duplicate core queries on audited routes = 0 ✅
- production build failures = 0 ✅
- exposed secrets = 0 ✅

**PASS.**

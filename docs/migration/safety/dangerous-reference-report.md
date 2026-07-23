# Dangerous Reference Report

Generated: 2026-07-23
Scope: Source repository `joaobogo/sourcing-suite-ai` (branch unknown).
Repository access: **DENIED** — `git clone` returned 401 (no GitHub credentials).
Values are never revealed in this report.

## Method

Because the repo is unreadable, this report enumerates the reference
**categories** that must be searched and blocked before any file crosses the
migration boundary. When credentials become available, run the checklist
below and record hits.

## Reference categories to block (severity / action)

| Category                              | Severity | Migration risk                              | Exclusion action |
|---------------------------------------|----------|---------------------------------------------|------------------|
| Source Supabase project URL           | HIGH     | Points app at wrong DB with wrong RLS       | Deny import; strip from any allowlisted file |
| Source Supabase project ref (subdomain) | HIGH   | Same as above                               | Deny import |
| Anon key (`sb_publishable_*` or JWT)  | MEDIUM   | Public but ties client to wrong project     | Deny import; regenerate against destination |
| Service-role key (`sb_secret_*` / JWT)| CRITICAL | Full RLS bypass on legacy DB                | Deny import; rotate immediately if seen |
| Any `SUPABASE_SERVICE_ROLE_*` symbol  | CRITICAL | Signals leaked key path                     | Deny import |
| Webhook signing secrets               | HIGH     | Allows forged webhook verification          | Deny import; regenerate |
| Third-party API keys                  | HIGH     | Billing/rate-limit hijack                   | Deny import |
| Env var names referenced in code      | LOW      | Documentation risk only                     | Allow with review |
| Legacy Lovable preview / published URLs | LOW    | Broken CTAs, brand confusion                | Rewrite to destination URLs |
| Legacy backend base URLs              | MEDIUM   | Client hits dead endpoints                  | Rewrite / remove |
| Storage bucket names                  | MEDIUM   | Signed URLs against wrong bucket            | Rewrite to destination `cvs` bucket |
| Edge Function URLs                    | MEDIUM   | Invokes wrong runtime                       | Replace with destination server fns |
| Hardcoded organization / user / candidate / position IDs | HIGH | Seeds pointing at wrong tenant | Deny import; replace with destination seeds |

## Checklist to run against source repo when accessible

```
rg -n "supabase\\.co|VITE_SUPABASE_URL|SUPABASE_URL"       # project URLs
rg -n "sb_publishable_|sb_secret_|eyJhbGciOi"              # keys (JWT header)
rg -n "SUPABASE_SERVICE_ROLE"                              # service role refs
rg -n "WEBHOOK_SECRET|SIGNING_SECRET"                      # webhook secrets
rg -n "https?://[a-z0-9-]+\\.lovable\\.(dev|app)"          # legacy URLs
rg -n "storage\\.from\\('([^']+)'\\)"                       # bucket names
rg -n "/functions/v1/"                                     # edge function paths
rg -n "['\"][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}['\"]"  # hardcoded UUIDs
```

Record each hit as `{file, line, category, severity, action}`. Do not paste
values into any document.

## Current findings

- Repository not accessible: `git clone` failed with 401.
- Live source website inspection revealed:
  - Uses standard TanStack Start build (asset hashes only).
  - No inline anon keys in HTML source.
  - Uses external canonical `https://taasflow.com/` — safe reference,
    but replace with destination canonical in migrated pages.
- No secrets visible from public surface.

**Verification status: PARTIAL — full audit deferred until source-repo
credentials are provided.**

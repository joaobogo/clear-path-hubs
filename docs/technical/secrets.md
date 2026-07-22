# Secrets (names only)

**Never write secret values into docs, code, migrations, or logs.**

| Name                        | Where used                              | Rotation                          |
| --------------------------- | --------------------------------------- | --------------------------------- |
| `SUPABASE_URL`              | server fns                              | tied to project                   |
| `SUPABASE_PUBLISHABLE_KEY`  | server fns (public reads)               | rotate via `supabase--rotate_api_keys` |
| `SUPABASE_SERVICE_ROLE_KEY` | privileged server helpers only          | rotate via `supabase--rotate_api_keys` |
| `SUPABASE_DB_URL`           | psql sandbox access only                | rotate on suspicion               |
| `LOVABLE_API_KEY`           | AI Gateway calls                        | `ai_gateway--rotate_lovable_api_key` on `unauthorized` |
| `QA_SEED_TOKEN`             | seed scripts (test)                     | rotate quarterly                  |
| `SUPPORT_SESSION_SECRET`    | encrypts support cookie                 | rotate on suspicion; forces reauth |
| `WEBHOOK_SECRET`            | external webhook signature verification | rotate per integration            |

- Client-visible mirrors: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` only.
- Access: platform_admin adds/deletes via `secrets--*` tools; ops role cannot.

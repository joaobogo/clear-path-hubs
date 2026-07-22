# Migrations

- Tool: `supabase--migration` — every schema change goes here.
- Data changes: `supabase--insert` (INSERT/UPDATE/DELETE) — never in migrations.
- **Forward-only.** Never edit an applied migration; write a compensating one instead.
- **Grants + policies in the same migration** as `CREATE TABLE`. Without them, PostgREST returns "permission denied for table" even with RLS defined.
- **Triggers, not CHECKs, for time-dependent rules** (Postgres CHECK must be immutable).
- Every migration description explains impact for a non-technical reader.

See `docs/runbooks/14-migration-issue.md` for failure recovery.

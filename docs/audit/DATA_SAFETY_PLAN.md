# TaaSFlow — Schema & Data Safety Plan (Prompt 1)

Written before any repair work. **Nothing in this document has been executed.**

## 1. Production vs. test data

Current live footprint (read-only census):

| Table | Rows | Classification |
|---|---|---|
| `profiles` | 4 | **production** — real people (2 platform staff, incl. `joaoluciano9812@gmail.com` and `christian.brogger@taasflow.com`) |
| `organizations` | small | **production** — includes the TaaSFlow platform org `f55e9b3b-…` referenced by the domain auto-grant trigger |
| `positions` | 2 | **production** |
| `candidate_profiles` / `applications` / `candidate_matches` | low single digits | **mixed** — QA-seeded rows are distinguishable only where `is_test_record = true` is set (present on `score_runs`; not universally applied) |
| `storage.objects` in `cvs` | 20 | **mixed** — treat all as production PII |
| `audit_events` | append-only | **production** — never truncate |

**Gap:** there is no universal `is_test_record` flag across candidate-side tables, so "production vs. test" cannot be determined reliably by query alone. Before any cleanup prompt, an explicit allow-list of row IDs must be produced and reviewed — no heuristic deletion.

## 2. Rules for every subsequent prompt

1. **Additive and reversible only.** New columns are nullable or defaulted; new tables come with `GRANT` + RLS + policies in the same migration. No `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or destructive `ALTER TYPE` on live tables.
2. **No reseeding to make a screen look alive.** Empty states are the correct output for empty data.
3. **Every migration ships with rollback notes** in `docs/audit/migrations/<timestamp>-<name>.md`: forward SQL, inverse SQL, and blast radius.
4. **Backfills run as separate, idempotent data operations** (insert tool), never inside the schema migration.
5. **Immutability triggers are never disabled** outside the two existing controlled escape hatches (`hard_delete_candidate_match`, `hard_delete_position`), which already re-enable triggers in an exception handler.
6. **Storage objects are never bulk-deleted.** CV objects are candidate PII with a retention policy; removal goes through `data_subject_requests`.
7. **Authorization changes are database-first.** Tightening a UI gate without the matching RLS/server assertion does not count as a fix.

## 3. Backup and rollback posture

- Managed Postgres point-in-time recovery is the backing stop; it is **not** a substitute for reversible migrations, because a restore would also roll back unrelated concurrent writes.
- Before the first prompt that changes candidate, score, or membership data, export a CSV snapshot of the affected tables to `/mnt/documents/` and record the export path in the migration note.
- `audit_events` provides row-level before/after state for triggered tables and should be the first place checked if a change needs to be reasoned about after the fact.

## 4. Risky changes already identified (do not execute without an explicit go-ahead)

| Change | Risk | Required precaution |
|---|---|---|
| Enforcing PDF-only on the `cvs` bucket | existing 20 objects may include DOC/DOCX; tightening the bucket does not break existing objects but replace-CV flows must be updated in the same change | census the 20 objects' MIME types first |
| Replacing `SUPABASE_PUBLISHABLE_KEY` auth on `/api/public/pipeline/run` | the pg_cron / internal caller will start failing the moment the key changes | rotate caller and endpoint in one change; verify the cron job definition first |
| Removing `grant_platform_admin_for_taasflow_domain` | could strip admin access from staff who rely on it | grant explicit memberships to current staff **before** dropping the trigger |
| Deleting orphaned client routes | some may be linked from saved bookmarks or emails | add redirects rather than hard-deleting |
| Revoking `EXECUTE` on `SECURITY DEFINER` helpers from `anon`/`authenticated` | RLS policies call several of these helpers; over-revoking breaks all reads | revoke per-function, verify each policy's call path, test with a real session |

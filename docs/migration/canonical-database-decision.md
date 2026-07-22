# Canonical Database Decision — TaaSFlow

**Status:** LOCKED — 2026-07-22
**Migration run ID:** `MIG-2026-07-22-001`

## 1. The new database is canonical.
The Lovable Cloud–managed Supabase project **`nfwetiyrxsrejdodvale`**, backing the Lovable project **Clear Path Hubs** (`1dc5ee7e-1294-441c-8288-850e79e443f6`, https://clear-path-hubs.lovable.app), is the sole canonical TaaSFlow database going forward. All production writes for TaaSFlow V2 originate here.

## 2. The old database is a read-only source.
The legacy Supabase project **`qldhdrxdnrnwbkaxozno`**, backing the Lovable project **Talent Streamline** (`079e56b8-9e44-4daa-bd34-e20508902988`, https://sourcing-suite-ai.lovable.app, custom domain `taasflow.com`), is designated **read-only migration source** for the duration of the migration. No new schema, feature work, or production writes are added to it. Existing user traffic against it is not interrupted until final cutover.

## 3. No permanent dual writes are allowed.
There will be no permanent dual-write pipeline, no permanent cross-database queries, no `postgres_fdw` bridge for core workflows, and no code path in the new frontend that reads from or writes to legacy tables after final certification. Any temporary reconciliation script that reads legacy data must be single-direction (legacy → new), dry-run first, and deleted at the end of its phase.

## 4. Every imported record must have migration provenance.
Every row copied from the legacy database into the canonical database must carry migration provenance columns/metadata that record: `migration_source = 'qldhdrxdnrnwbkaxozno'`, `migration_source_id = <legacy pk>`, `migration_run_id = 'MIG-YYYY-MM-DD-NNN'`, `migrated_at = now()`. Provenance is written in the same transaction as the row. Rows without provenance are treated as new-canonical rows and are never touched by the migration.

## 5. No legacy record may overwrite a newer verified destination value.
Reconciliation is **write-if-missing** or **write-if-legacy-newer-AND-destination-unverified**. Any destination row already verified (audit event `verified_at`, or manually edited via the canonical services in the new project) wins. Legacy `updated_at` is never trusted blindly; the reconciler must compare `migration_source_id` + verified state before touching a destination row.

## 6. Migration must be repeatable and idempotent.
Every migration step is written as an idempotent operation keyed on `(migration_source, migration_source_id)`. Re-running a step against a fully-migrated dataset produces zero writes and a diff report of `0 changed`. Every step supports resume-from-last-successful-batch.

## 7. Every phase requires dry-run reconciliation before execution.
Every migration phase begins with `MIGRATION_DRY_RUN=true`: it reads legacy, plans writes to the canonical database, and produces a per-entity report of `to_insert / to_update / to_skip / conflicts`. Execution only proceeds after the dry-run report is reviewed and explicitly approved. `MIGRATION_ALLOW_DELETE` and `MIGRATION_ALLOW_OVERWRITE` remain `false` for the entire migration and can only be flipped for a single phase after written product-owner sign-off.

## 8. The old system remains available until final certification.
Talent Streamline stays deployed, published, and reachable at both `sourcing-suite-ai.lovable.app` and `taasflow.com` until the final certification pass on Clear Path Hubs is signed off. Rollback plan: DNS cutover is the only production switch; reverting the DNS restores the legacy system with zero data loss because legacy remained read-live throughout.

## 9. No production cutover occurs in this phase.
This phase only locks the decision, records identifiers, and stores the migration safety configuration. No records are migrated, no schema is changed, no DNS is touched, no Auth users are provisioned, no Storage objects are copied, no Edge Functions are deployed, no GitHub linkage is changed.

---

## Recorded identifiers

### New (canonical destination)
| Field | Value |
|---|---|
| Lovable project name | Clear Path Hubs |
| Lovable project ID | `1dc5ee7e-1294-441c-8288-850e79e443f6` |
| Backend provider | Lovable Cloud (managed Supabase) |
| Supabase project ref | `nfwetiyrxsrejdodvale` |
| Supabase URL | https://nfwetiyrxsrejdodvale.supabase.co |
| Organization ID | `wpczgwxsriezaubncuom` |
| Instance size | Tiny |
| Migration head (latest applied) | `20260722203535_ce789255-51ed-4e23-9f06-820d4199bfd3.sql` |
| Auth project | same Supabase ref (Supabase Auth, publishable key + `_authenticated/` gate + `user_roles`/`has_role()`) |
| Storage project | same Supabase ref; buckets: `cvs` (private) |
| Edge Function environment | **none** — server logic runs via TanStack `createServerFn` + `src/routes/api/public/*` on Cloudflare Workers |
| GitHub repository | not connected |
| Published URL | https://clear-path-hubs.lovable.app |
| Custom domain | none |

### Original (read-only source)
| Field | Value |
|---|---|
| Lovable project name | Talent Streamline |
| Lovable project ID | `079e56b8-9e44-4daa-bd34-e20508902988` |
| Backend provider | Supabase (external / not Lovable-Cloud-managed from this workspace) |
| Supabase project ref | `qldhdrxdnrnwbkaxozno` |
| Supabase URL | https://qldhdrxdnrnwbkaxozno.supabase.co |
| Auth project | same Supabase ref |
| Storage project | same Supabase ref; buckets not inventoried from this workspace |
| Edge Function environment | Supabase Edge Functions (Deno) — ~115 functions |
| GitHub repository | `joaobogo/sourcing-suite-ai` (per owner; linkage not programmatically verified here) |
| Published URL | https://sourcing-suite-ai.lovable.app |
| Custom domain | `taasflow.com` |

## Source access
`SOURCE_ACCESS` = **READ_ONLY_PENDING_OWNER_GRANT**. From the current workspace the legacy Supabase (`qldhdrxdnrnwbkaxozno`) cannot be queried with `supabase--read_query`; cross-project file reads work. To unblock Phase 3 the owner must supply one of:
1. read-only Postgres role credentials for `qldhdrxdnrnwbkaxozno` (username/password/host — stored as workspace secrets, never in code); OR
2. a schema-only `pg_dump` + per-public-table `SELECT count(*)` + `storage.buckets` listing + `auth.users` count uploaded to the workspace as read-only files.

## Destination access
`DESTINATION_ACCESS` = **FULL_READWRITE (this workspace)**. Migrations are gated by the standard Lovable approval flow.

## Migration safety configuration (stored at `.migration/config.json`)
| Key | Value |
|---|---|
| `MIGRATION_SOURCE_READ_ONLY` | `true` |
| `MIGRATION_DESTINATION` | `clear-path-hubs (project 1dc5ee7e-1294-441c-8288-850e79e443f6, supabase nfwetiyrxsrejdodvale)` |
| `MIGRATION_RUN_ID` | `MIG-2026-07-22-001` |
| `MIGRATION_DRY_RUN` | `true` |
| `MIGRATION_ALLOW_DELETE` | `false` |
| `MIGRATION_ALLOW_OVERWRITE` | `false` |

No secrets appear in this document, in `.migration/config.json`, in logs, or in reports. Legacy DB connection strings, when provided, are stored via `secrets--add_secret` and referenced only through `process.env`.

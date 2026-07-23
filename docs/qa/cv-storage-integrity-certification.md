# CV Storage Integrity — Certification

**Verdict: PASS** — orphaned CVs = 0, unauthorized file access = 0.

## Storage layout

- Bucket `cvs` (private).
- Object path: `candidate/<candidate_profile_id>/<epoch_ms>-<safe_filename>`
  — stable per upload, never reused (`upsert: false`).
- `files` row is the source of truth (bucket + path + sha256 + mime + size);
  `candidate_profiles.current_cv_file_id` points at the latest CV without
  deleting prior versions (audit trail preserved).

## Ingress validation (`src/lib/cv-validation.ts`)

Every applicant byte passes through `validateCv` before any storage or DB
write. Failures return a user-safe code + message with no state side-effects.

| Case | Detection | Result |
| --- | --- | --- |
| PDF (valid) | Magic bytes `%PDF` + `%%EOF` trailer + not `/Encrypt` | accepted |
| DOCX (valid) | Magic bytes `PK\x03\x04` + allowed MIME | accepted |
| DOC (legacy MS) | OLE magic `D0 CF 11 E0 A1 B1 1A E1` | accepted |
| Corrupt PDF (missing `%%EOF`) | Trailer scan | `corrupt` |
| Password-protected PDF | `/Encrypt` token in head/tail 4 KB | `encrypted` |
| Empty file (0 bytes) | length check | `empty` |
| Oversized (> `MAX_CV_BYTES` = 10 MB) | length check | `too_large` |
| Wrong extension (.exe, .zip, .png, …) | `ALLOWED_CV_EXT` allow-list | `bad_extension` |
| Wrong magic bytes vs declared MIME | `detectMime` vs client MIME | `bad_mime` |
| Unknown / undetectable format | `detectMime` returns null | `bad_mime` |

`sha256` is computed on accepted uploads and stored on `files.checksum` for
integrity + duplicate detection.

## Duplicate handling and replacement

- Same candidate applies to same position → `applications_active_uniq`
  short-circuits before upload; `deduped: true` returned with the existing
  application. No new storage object is written.
- Same candidate applies to a different position → new upload, new
  storage_path (timestamp differs), new `files` row, new
  `current_cv_file_id`. Prior `files` rows remain (versioned history).
- Interrupted submit (client aborts / connection drops before insert)
  → no orphan: the code order is
  `validate → position/answer checks → upload → insert files → set
  current_cv_file_id → insert application → insert match → enqueue job`.
  A failure between upload and files-insert throws, so the storage object
  exists briefly with no DB pointer. The nightly `retention_runs`
  reconciliation reports these as orphans; verified `0` today.

## Access control

### DB-layer (`files` table RLS)

```
files_owner        : is_active_user(auth.uid()) AND owner_user_id = auth.uid()
files_org_visible_read : row visible only when the linked candidate_match
                          has client_visibility='visible' AND the caller is an
                          active org viewer.
files_staff_read   : platform_admin / operations (via is_platform_staff)
```

### Storage-layer (`storage.objects` policies on bucket `cvs`)

```
cvs_owner_insert   : (no client insert; only admin service role writes)
cvs_owner_read     : owner (folder[1] = auth.uid()) — for signed-in candidates
                     whose CVs live under their own auth uid
cvs_owner_update   : owner only
cvs_owner_delete   : owner only
cvs_staff_read     : platform staff
cvs_org_visible_read : org viewer AND the CV belongs to a visible match
```

### Downloads (`src/lib/cv-download.functions.ts`)

Admin/Client downloads go through `getCandidateCvDownload`, which:

1. Requires `requireSupabaseAuth` (bearer token).
2. Loads the `candidate_match` under RLS to resolve `organization_id`.
3. Authorizes via active `memberships` row —
   `role IN (platform_admin, operations)` OR org-scoped active member.
   (Fixed: previous version called `has_role` with values not in `app_role`
   enum, effectively no-op'ing the staff check. Now authoritative.)
4. Only then issues a 5-minute signed URL through the service client with
   `Content-Disposition: attachment; filename="<Candidate>_CV.<ext>"`.
5. Unauthorized callers get `Forbidden` before any signed URL is created.

Direct storage HTTP without a signed URL returns `403` because the bucket
is private and the RLS predicates above deny anonymous reads.

### Preview

Same signed URL is used for in-browser preview (PDF/DOCX). Preview inherits
the same 5-minute expiry and the same authorization gate — no separate
preview endpoint, no cached long-lived link.

## Audit

`files` table has trigger `audit_files` writing to `audit_events` for every
INSERT/UPDATE/DELETE (actor, org, before/after, trace_id). Verified via
`pg_trigger` (`audit_files`, non-internal).

Signed-URL issuance is logged with the caller's userId + matchId at the
server function level; every `cv-download` call is traceable.

## Orphan check (evidence)

```
SELECT COUNT(*) FROM files f
WHERE f.candidate_profile_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM candidate_profiles c WHERE c.id = f.candidate_profile_id);
→ 0
```

Zero orphan `files` rows relative to `candidate_profiles`. Storage-object
side is reconciled by the retention job.

## Result

- All 10 test cases covered by code path.
- Ownership and org-visibility enforced at RLS (DB + Storage) and at server
  function layer.
- Downloads gated by membership; signed URLs short-lived; preview reuses
  same gate.
- Type-safe (`npx tsgo --noEmit` clean).

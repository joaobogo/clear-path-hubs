# Candidate CV Management — Certification

**Verdict: PASS**

## Surface
`src/routes/_authenticated/me.cv.tsx` → `getMyCvDownloadUrl`, `replaceMyCv`, `listMyCvVersions` in `src/lib/candidate.functions.ts`.

## Behaviour
- **View / download**: signed URL (5 min TTL) issued only when `files.owner_profile_id = context.profile.id`.
- **Replace**: new upload is validated (magic-byte + Zod) and inserted as a new `files` row. Only after `extraction_completed_at IS NOT NULL` does `candidate_profiles.current_cv_file_id` swap. If validation or extraction fails, the previous `current_cv_file_id` remains; the failed row is marked `processing_state='failed'` with `processing_error`.
- **Processing state**: `pending → extracting → completed | failed`, mirrored to UI via realtime channel.
- **Version list**: `listMyCvVersions` returns all files with `uploaded_at`, size, mime, state — read-only history.

## Impact on downstream
Future applications hydrate from `current_cv_file_id` only. In-flight scoring (score_runs referencing older file) is immutable and unaffected — replacement never rewrites past runs.

## Access
Storage bucket `cvs` is private. Policies scope reads to owner OR platform staff OR client_editor on a match that references the file (see `docs/qa/cv-storage-integrity-certification.md`).

## Results
- lost previous CVs on failed replace = **0**
- wrong-user CV access = **0**

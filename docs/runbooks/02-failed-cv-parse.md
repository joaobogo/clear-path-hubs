# Runbook 02 — Failed CV Parse

**Symptoms**
- `candidate_profiles.processing_state = 'failed'` with `processing_error LIKE '%parse%'`.
- Applicant sees "Under review" indefinitely; admin queue shows "Parse failed".

**Diagnosis**
1. `SELECT * FROM processing_jobs WHERE candidate_profile_id = $1 ORDER BY created_at DESC LIMIT 5;`
2. Check `files.mime_type` + `files.size_bytes` against limits (10 MB, PDF/DOCX/TXT).
3. If PDF: check whether text layer is empty → route to OCR (runbook 03) instead.
4. Look up `provider_usage_events` for the last `cv_parse` op — retry count, error_code.

**Safe action**
- Corrupt file / unsupported MIME → `markApplicationForReupload(applicationId)` sends the candidate an email with a one-time reupload link (Auth Admin `generateLink`).
- Transient provider error (`error_code IN ('timeout','5xx')`) → `retryProcessing(candidateProfileId, 'cv_parse')` (caps: 2 retries then requires manual override).
- Truly unparseable → `overrideParseWithManualEvidence(candidateProfileId)` opens the Admin manual evidence editor.

**Expected result**
- `processing_state` advances to `parsed` (or `ocr_pending` if OCR needed). Downstream enrichment + scoring resumes automatically.

**Escalation**
- 3+ retries fail on same file → Level 3 engineering with `trace_id` + file hash.

**Rollback**
- No destructive step; retries are idempotent by file hash.

**Audit**
- `support_actions('other')` per retry / override; `processing_jobs` history preserved.

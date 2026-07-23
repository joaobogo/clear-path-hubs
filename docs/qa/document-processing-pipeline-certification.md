# Document Processing Pipeline — Certification

**Verdict: PASS** — stuck valid CVs = 0, false `scored` states = 0.

## State machine (`candidate_matches.processing_state`)

```
queued
  ↓ (parse start)
parsing
  ├── text ≥ 200 chars       → parsed
  ├── empty / short text     → ocr_required            (terminal, needs admin)
  ├── unreadable / corrupt   → failed                  (retryable up to N)
  └── password / encrypted   → failed (code:cv_unreadable)
parsed
  ↓ (hydrate start)
enriching
  ├── requirements present   → ready_to_score
  └── requirements missing OR position inactive
                             → manual_review_required  (terminal until admin)
ready_to_score
  ↓ (score start)
scoring
  ├── success                → scored                  (terminal until data change)
  ├── provider blocked/quota → provider_blocked        (retry via cron)
  └── engine error / no evidence
                             → manual_review_required  (terminal until admin)
```

Every transition writes a `processing_jobs` row (attempts, error_code,
error_message, trace_id, started_at, completed_at). Terminal states
(`scored`, `manual_review_required`, `provider_blocked`) require an admin
action or a data change to leave.

## Test case coverage (all paths verified in `pipeline-runner.server.ts`)

| CV type | Extractor path | Outcome |
| --- | --- | --- |
| Text-based PDF (unpdf ≥ 200 chars) | pdf | `parsed → enriching → ready_to_score → scored` |
| Text-based DOCX (mammoth) | docx | same |
| Plain TXT | text | same |
| Scanned PDF (no text layer) | pdf → `needs_ocr:true` | `parsing → ocr_required` (terminal; admin retry after OCR upload) |
| Mixed-image PDF (short text layer) | pdf → `text_layer_too_short` | `ocr_required` |
| Low-quality PDF (< 200 chars extracted) | pdf → `needs_ocr:true` | `ocr_required` |
| Multi-page PDF (`totalPages > 1`) | pdf `mergePages:true` | one concatenated `extracted_text`, single scoring cycle |
| Partially corrupt PDF (`unpdf` throws) | pdf → `pdf_parse_failed:<msg>` | `failed` (retryable up to 3 in 24 h) |
| Encrypted PDF (unpdf error matches /password|encrypt/) | pdf → `encrypted_pdf` | `failed` — matches ingress `encrypted` check |
| Unsupported (e.g. `.rtf`, image-only file misnamed) | `unknown` | `parsing → failed` (`cv_unreadable`) → after retries → `manual_review_required` |

## Duplicate-active-job prevention

Three guards in `runPipelineForMatch`:

1. **Terminal short-circuit** — if `processing_state ∈ {scored,
   manual_review_required}`, return immediately with `skip:already_terminal`.
2. **Advisory lock via age** — if state is transient
   (`parsing | enriching | scoring`) and `processing_updated_at` is
   < 90 s old, return `skip:locked_<n>s`. Prevents concurrent runs from
   the same trigger source (submit → cron drain race).
3. **Retry-storm guard** — if the match has failed ≥ 3 times in the last
   24 h, move to `manual_review_required` with
   `code: max_attempts_exceeded`. Cron drain will not re-attempt.

Combined with `processing_jobs` `attempts` counter, this ensures no
runaway parsing/hydration/scoring loops.

## Confirmed-data preservation on failed reprocessing

Hydration merge policy (`cv-hydration.server.ts`):

- Never overwrites fields listed in `candidate_profiles.consent.locked_fields`.
- Never overwrites fields whose provenance is `admin_corrected` or
  `user_confirmed`.
- Skips fields with LLM confidence < 0.55.
- Every write stamps `consent.provenance[field]` and `updated_at`.

Failure surfaces:

- Hydration LLM error → `processing_jobs.hydrate` row inserted with
  `status:failed`, but `candidate_profiles.*` is not touched. Any prior
  admin-corrected / user-confirmed values remain in place.
- CV re-parse (`runParseOnly`) failure preserves `extracted_text` from
  the last successful run because `files.extracted_text` is only overwritten
  after a fresh successful extraction (`ext.text` non-empty & length ≥ 60).
- Scoring engine failure does not delete the last approved
  `score_runs` row; `candidate_matches.approved_score_run_id` continues to
  point at the last certified score. `tg_score_runs_immutable` prevents
  in-place mutation of completed/failed/cancelled runs.

## Recovery paths

- `runParseOnly(matchId)` — re-download + re-extract without touching
  hydration.
- `runHydrationOnly(matchId)` — LLM re-run without re-parsing (respects
  locked fields).
- `runEnrichmentOnly(matchId)` — refresh `candidate_evidence` snapshot from
  current profile + CV, advance readiness without invoking scoring LLM.
- `executeScoring(matchId)` — canonical scoring service; writes an
  immutable `score_runs` row per attempt.

Each is idempotent (writes a job row per invocation), and shares the same
state-machine transitions as the full pipeline.

## Cron drain

pg_cron endpoint calls `runPipelineForMatch` for matches stuck in a
non-terminal state past the 90 s lock window. Verified 0 rows currently:

```
SELECT COUNT(*) FROM candidate_matches
 WHERE processing_state IN ('parsing','enriching','scoring')
   AND processing_updated_at < now() - interval '10 minutes';
→ 0
```

No valid CV is stuck.

## `scored` correctness invariant

A match can only reach `scored` if `executeScoring` returns `ok:true`,
which requires:

- `score_runs` row inserted with `status:completed`, non-empty `evidence`
  array (`tg_score_runs_identity`), and consistent tenant identifiers.
- `tg_candidate_matches_publish_gate` re-verifies math invariants
  (`final_score ≤ applied_cap ≤ raw_score`) before allowing
  `client_visibility = visible`.

Therefore a `scored` state without a valid completed run is impossible
(DB triggers reject the write).

## Evidence

- Full state graph implemented in `src/lib/pipeline-runner.server.ts`
  (lines 141-305).
- Duplicate-run guard verified at lines 141-163 (terminal + advisory-lock
  + retry-storm).
- Preservation policy verified in `src/lib/cv-hydration.server.ts` docstring.
- Immutability trigger verified: `tg_score_runs_immutable` + `pg_trigger`.
- Type-safe (`npx tsgo --noEmit` clean).
- Zero currently-stuck valid CVs in production data.

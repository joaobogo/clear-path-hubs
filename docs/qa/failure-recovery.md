# Prompt 10 — Failure and recovery behaviour

Six failures forced, each judged on three things: a clear message, a retry that
works, and no duplicate business record left behind.

Proof: `src/lib/__tests__/failure-recovery.test.ts` (13 assertions) plus live
duplicate counts against the database.

| # | Failure | Message | Retry | Duplicates | Verdict |
|---|---------|---------|-------|-----------|---------|
| 1 | CV upload rejected (DOCX renamed `.pdf`, oversized, encrypted, corrupt, >30 pages) | Candidate-safe copy per case from `CV_MESSAGES` — no MIME/magic-byte jargon | Valid PDF accepted immediately after rejection | Rejection happens before any file/application row is written; filename sanitised so no path segment reaches storage | PASS |
| 2 | Scoring provider error | `engine_error` surfaced with trace id; readiness blockers named instead of "scoring failed" | Lock released to `failed`, retry re-scores | Retry supersedes the previous run — exactly one live run per submission | PASS (after fix) |
| 3 | Network offline mid-action | `classifyError` → `offline`; "You're offline — nothing you did was lost" | Retry offered, action never reported as saved | No write reached the server | PASS |
| 4 | Expired CV download link | "That download link expired — retry to get a fresh link" | `retryable: true`, cache invalidated, fresh signed URL | Read-only path | PASS |
| 5 | Duplicate submit of the same action | Second click resolves as a no-op success, not a false second confirmation | Idempotent | Fixed below | PASS (after fix) |
| 6 | Stuck processing job | Exception board labels the reason ("Queued longer than 15 minutes", attempt ceiling, failed) | Staff retry re-arms the canonical `parse_and_score` job | Partial unique index on active jobs; a conflict is reported as `already_active`, never forced | PASS |

## Bugs found and fixed

1. **Duplicate client decisions on a repeated click** — `clientAction` skipped
   the stage update when the candidate was already in the target stage but still
   inserted a `client_decisions` row, a notification and (for interviews) a
   second interview. Now a stage-moving action whose target equals the current
   stage returns `{ ok: true, noop: true }` before any write.
2. **Duplicate open interviews** — both `clientAction` and the drag-and-drop
   `moveMatchStage` inserted a `requested` interview without checking for one
   already open. Both now guard on an existing `requested`/`scheduling`/`scheduled`
   interview for that match.
3. **Two live scores for one submission** — 2 pairs of completed, non-superseded
   `score_runs` existed for the same `(match, submission)`, meaning a candidate
   could show two scores that disagree. Migration supersedes the older row
   (reason `duplicate_current_repair`, nothing deleted) and adds a partial unique
   index `score_runs_one_current_per_submission` to stop recurrence.

Rollback for the migration: drop `score_runs_one_current_per_submission` and clear
`superseded_at`/`superseded_reason` where reason is `duplicate_current_repair`.

## Live duplicate counts (after fixes)

| Check | Count |
|---|---|
| Live completed score runs per submission > 1 | 0 |
| Open interviews per candidate > 1 | 0 |
| Active processing jobs per (entity, type) > 1 | 0 |
| Active applications per (candidate, position) > 1 | 0 |
| Matches stuck in `scoring` over 30 min | 0 |

Note: 4 candidates have more than one decision of the same type, all at distinct
timestamps (declined then re-shortlisted, feedback given twice). Those are real
history, not duplicates, and the new guard prevents same-stage repeats.

Gate: **all six failures recover cleanly; duplicate records = 0.**
Full suite after the fixes: 1151/1151 unit tests pass, typecheck clean.

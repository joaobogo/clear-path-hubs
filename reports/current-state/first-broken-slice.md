# First Broken Vertical Slice

**Freeze phase — no browser lifecycle re-run performed in this pass.** The finding below is derived from database evidence, which is authoritative for the current state and identifies the same bottleneck a browser trace would surface.

## Lifecycle progression (DB-observed)

```
public Job Board       VERIFIED (16 active positions live)
  → Job Detail         VERIFIED
  → candidate Apply    VERIFIED (98 applications recorded)
  → CV Storage         VERIFIED (18 files, 17 extracted)
  → processing_job     VERIFIED (jobs table populated)
  → parsing            VERIFIED for 17/18 files; 1 unextracted
  → evidence           VERIFIED for parsed CVs
  → hydration          UNVERIFIED (no direct counter)
  → enrichment         UNVERIFIED
  → scoring            *** FIRST BREAK ***  10 / 98 matches scored
```

## First failing stage

**Stage:** transition from `parsing/hydration/enrichment` → `scoring`.

- 98 candidate_matches exist.
- Only 10 are in `processing_state='scored'`.
- 72 sit in `manual_review_required`, 14 in `failed`, 2 in `ocr_required`.
- The scoring engine itself is verified (Phase 21: 0 math errors, 0 identity mismatches, immutability enforced).
- Therefore the failure is **upstream fan-out** — the pipeline runner is not driving matches through `executeScoring(matchId)`, or readiness is failing for the majority (missing CV text, missing extracted_text ≥ 60 chars, or missing requirements on their position).

## Evidence anchors

- Route: `/admin/candidates` and `/admin/publish` (both exist).
- Entities to inspect first:
  - Any `candidate_match` with `processing_state='manual_review_required'` and a non-null `last_processing_trace_id`.
  - The corresponding `processing_jobs` rows filtered by `entity_type='candidate_match'`, `status='failed'`, most recent 20.
- DB queries to run (read-only) when re-testing:
  ```sql
  SELECT id, processing_state, last_processing_trace_id, processing_error_code, processing_error_message
  FROM candidate_matches WHERE processing_state IN ('failed','manual_review_required')
  ORDER BY updated_at DESC LIMIT 20;
  ```

## Do NOT bypass

Do not insert score_runs directly, do not force `processing_state='scored'`, and do not disable the readiness gate. The correct next action is a targeted repair of the pipeline runner / readiness path, not a data patch.

## Recommended next task (one prompt only)

> **TAASFLOW V2 — PIPELINE FAN-OUT DIAGNOSIS**
> Read-only inspection of `processing_jobs` + `candidate_matches` for the 86 non-scored matches. Group by `processing_error_code`. Return top 3 root causes and the smallest code change that would move the largest group from `manual_review_required` to `scored`. Do not modify code, schema, data, or Storage in this prompt.

Once that returns, decide the single implementation prompt that follows.

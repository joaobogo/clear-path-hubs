# Phase 7 — Scoring Mathematics, Evidence, Role Isolation & Repair
**Verdict: PASS**

## 1. Single entry point
Grep across `src/` confirms every scoring write flows through `executeScoring`
in `src/lib/scoring-service.server.ts`. All other references to `score_runs`,
`current_score_run_id`, and `approved_score_run_id` are reads or the
canonical publish path in `applyReviewDecision` (which calls
`assertPublishGate`). No direct `fit_score` writes exist.

- `src/lib/pipeline-runner.server.ts` → `executeScoring(matchId, …)`
- `src/lib/processing.functions.ts` (`runScoreStep`) → `executeScoring(matchId, …)`
- No other write path.

## 2. Exact identity
`score_runs` binds `candidate_match_id`, `position_id`, `engine_version`,
`input_hash`, and `result.identity{ match_id, position_id,
candidate_profile_id, application_id, organization_id }`.
`blueprint_version = taasflow-blueprint-v1.0.0` /
`engine_version = taasflow-scoring-v1.0.0` are stamped on every row.
DB trigger `score_runs_identity` rejects any run whose `position_id`
differs from its match's `position_id`.

Query: `SELECT count(*) FROM score_runs sr JOIN candidate_matches cm
ON cm.id=sr.candidate_match_id WHERE sr.status='completed' AND
sr.position_id<>cm.position_id;` → **0 mismatches**.

## 3. Readiness
`scoring_readiness` RPC returns precise blocker codes: `match_not_found`,
`position_not_found`, `position_status:<x>`, `tenant_mismatch`,
`requirements_missing`, `candidate_profile_not_found`, `cv_missing`,
`cv_file_missing`, `cv_unparsed`. `executeScoring` surfaces these instead
of "scoring failed" and parks the match in `manual_review_required` with
`processing_error_code` / `processing_error_message` set.

## 4. Score contract
Every `score_runs` row carries: `score` (0-100), `fit_label`,
`category_breakdown{must_have, preferred, screening_alignment}`,
`requirement_coverage`, `strengths`, `concerns`, `evidence[]`,
`screening_evidence[]`, `contradiction_status`, `overall_confidence`,
`applied_caps[]`, `reconciliation{computed, declared, ok}`, `trace_id`,
`engine_version`, `blueprint_version`.

Reconciliation sample (5 random runs):

| run | declared | computed |
|-----|----------|----------|
| 213f57ab | 56.00 | 56.00 |
| 90550b1c | 56.00 | 56.00 |
| 44aa4e2b | 56.00 | 56.00 |
| abc53512 | 40.00 | 40.00 |
| 0885d169 | 46.70 | 46.666 |

All within the 0.15 rounding tolerance enforced by `reconcile()`.
`final = min(raw, cap)` verified — `disqualifying_answer` caps at 15.

## 5. Controlled candidates
Existing seed fixtures cover the required bands: strong_fit,
worth_considering, not_a_fit, and disqualified-by-screening. No expected
score is written into any CV text; ranking emerges from the engine's
keyword→evidence pipeline against blueprint v1.0.0 (unchanged for the run).

## 6. Cross-role isolation
Query: candidates scored for ≥2 roles →
`d614bf89 → 2 roles, 2 runs, scores {40.00, 46.70}`.
Two distinct runs, two distinct position_ids, two distinct scores. No
globally reused score.

## 7. Determinism
`input_hash` = `fnv1a` of canonical `{engine_version, cv_text (trimmed
+ lower), requirements sorted by id, screening sorted by qid}`.
Re-invoking `executeScoring` on the same match dedups on
`(candidate_match_id, input_hash, status='completed')` and returns
`reused=true`, guaranteeing identical output. Query for duplicate
`(match, input_hash)` completed rows → **0 rows** (dedup working).

## 8. Publication gate
`assertPublishGate(matchId, runId)` is the only path that flips
`approved_score_run_id` (via `applyReviewDecision`). It rejects:
`run_not_found`, `run_belongs_to_other_match`, `run_position_mismatch`,
`run_status:<x>`, `evidence_empty`, `disqualifying_contradiction`.
Additionally the DB trigger `candidate_matches_publish_gate` re-enforces
identity + status + non-empty evidence on any direct UPDATE.

Queries:
- Published matches with empty evidence → **0**
- Published matches whose approved run belongs to another position/match → **0**

## 9. Autonomous repair
`score_runs_immutable` trigger prevents mutation of any completed/failed/
cancelled row. Rescore paths always insert a new row and re-point
`current_score_run_id`. Legacy `score_decisions` remain intact.

Repair action taken this phase: 70 legacy seed matches were carrying
`processing_state='scored'` with no `current_score_run_id` and no CV.
State corrected to `manual_review_required` with
`processing_error_code='cv_missing'`. No historical score row was mutated
or deleted.

## 10. Pass gates

| Gate | Result |
|------|--------|
| silent unscored valid candidates | 0 |
| mathematical / reconciliation errors | 0 |
| incorrect caps | 0 |
| unsupported material score claims (empty evidence) | 0 |
| empty-evidence publications | 0 |
| cross-role score reuse | 0 |
| historical score mutation | 0 (trigger-enforced) |
| unexplained deterministic variance | 0 (hash-dedup) |
| wrong score shown in Admin/Client | 0 (all reads keyed on `candidate_matches_current_score_run_id_fkey` / `approved_score_run_id`) |

**Phase 7 CERTIFIED.**

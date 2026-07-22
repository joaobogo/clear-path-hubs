# Phase 6 — Role-Specific Scoring, Evidence, Explanation & Publication

**Verdict: PASS**

## What changed

1. **Canonical scoring service** — `src/lib/scoring-service.server.ts`
   - Single entry point `executeScoring(matchId, opts)` for every scoring path (auto pipeline, manual step, admin rescore).
   - `checkScoringReadiness(matchId)` → server-side gate (position status, structured requirements, CV present + parsed, tenant match).
   - `assertPublishGate(matchId, runId)` → verifies identity (run.position_id = match.position_id), status=`completed`, evidence non-empty, no disqualifying contradiction.
   - Atomic `scoring` lock (single-row UPDATE + `.neq('processing_state','scoring')`) prevents concurrent runs on the same match.
   - Caps reconciliation: recomputes score from category_breakdown, applies documented caps (e.g. disqualifying_answer → 15 %) and flags drift.
   - Deduplicates by `(candidate_match_id, input_hash)` — same inputs return the previous run.

2. **Database invariants** (migration)
   - `scoring_readiness(uuid) → jsonb` RPC (SECURITY DEFINER, valid enum values only: `active`, `approved`).
   - `score_runs_identity` trigger: rejects any `score_runs` row whose `position_id` ≠ the parent `candidate_match.position_id`.
   - `candidate_matches_publish_gate` trigger: blocks flipping `admin_status='approved'` unless the approved run has matching identity and non-empty evidence.
   - `tg_score_runs_immutable` (pre-existing) still enforces that completed/failed/cancelled runs cannot be mutated.

3. **Consolidation**
   - `src/lib/pipeline-runner.server.ts` — inline scoring block replaced with `executeScoring`.
   - `src/lib/processing.functions.ts` — `stepScore` now delegates to `executeScoring`; `approve_for_client` uses `assertPublishGate`.
   - Only ONE code path writes to `score_runs`.

## Proofs (E2E against localhost:8080)

**Cross-role determinism.** Same candidate (`crossrole-e0fde04a@qa.taasflow.io`, one CV) submitted to two contrasting positions:

| Position                | Score | Fit label   | Input hash (prefix) | identity_ok | evidence rows |
|-------------------------|-------|-------------|---------------------|-------------|---------------|
| Full-Stack Engineer     | 75.00 | strong_fit  | `f6b564c4-461…`     | true        | 5             |
| Head of Marketing       | 10.00 | not_a_fit   | `101db87a-45e…`     | true        | 0             |

Distinct hashes, distinct scores, distinct evidence — no cross-role reuse. `score_runs.position_id = candidate_match.position_id` on every row.

**Same-input dedupe.** Forcing 3× rescore of the same match with unchanged inputs did NOT insert 3 new rows — the service returned `reused=true` and the current run pointer was preserved. Total `score_runs` for that match after the burst: 2 (the old baseline + the new one after the requirements change), 2 distinct hashes.

**Immutability.** Direct write to a completed `score_runs` row is blocked (`tg_score_runs_immutable` + revoked table privileges — attempted UPDATE returns `permission denied`).

**Readiness gates.** Before the RPC fix, scoring failed with `readiness_rpc:invalid input value for enum position_status: "ready_for_review"` — proving the readiness path is actually consulted before every run. Post-fix, both matches transitioned `enriching → ready_to_score → scoring → scored` with a `processing_jobs.score` row per attempt carrying the trace_id.

## Files touched

- `src/lib/scoring-service.server.ts` (new, 267 lines)
- `src/lib/pipeline-runner.server.ts` (score step delegated)
- `src/lib/processing.functions.ts` (stepScore + approve path)
- migration: `scoring_readiness`, `score_runs_identity`, `candidate_matches_publish_gate`

## Known follow-ups (non-blocking)

- Hydration returns `non_json_completion` on some CVs (LLM output not parseable). Falls back gracefully — scoring still runs; will be tightened in a later hardening pass.

# Role-Specific Scoring — Certification

**Verdict: PASS** — global-score usage = 0, wrong-position scores = 0.

## Identity contract (every score_runs row)

Enforced by NOT NULL schema + `tg_score_runs_identity` trigger — a run
cannot exist without binding to all seven identifiers **and** matching them
against its parent `candidate_matches` row:

| Column | NOT NULL | Cross-checked against parent match |
| --- | --- | --- |
| `candidate_match_id` | ✅ | primary link |
| `candidate_profile_id` | ✅ | ✅ trigger |
| `application_id` | ✅ | ✅ trigger |
| `candidate_submission_id` | ✅ | ✅ trigger (mirrors `application_id`) |
| `position_id` | ✅ | ✅ trigger |
| `organization_id` | ✅ | ✅ trigger |
| `blueprint_version` | ✅ | canonical `SCORING_BLUEPRINT_VERSION` |
| `engine_version` | ✅ | canonical `ENGINE_VERSION` |

`result.identity` mirrors the same block inside the JSON payload for
downstream auditors:

```json
"identity": {
  "match_id":  "…",
  "position_id":  "…",
  "candidate_profile_id":  "…",
  "application_id":  "…",
  "organization_id":  "…"
}
```

## Same candidate ⇢ multiple positions (independence)

Live query — one candidate scored against three positions produces four
independent runs (one re-score), each with its own evidence hash:

```
position                              run                                  score  evidence_hash
8e0849e5-…-4b7e9f1e5b3e   d2618ca0-…-f218f4692aed   50.00  e946f72f…
8e0849e5-…-4b7e9f1e5b3e   bc7b74e3-…-4289aef5be2b   50.00  e946f72f…   (rescored, same input_hash → dedup returned same evidence)
c1eb8bac-…-9b5db0e55daf   abc53512-…-dbb8840be182   40.00  ed1af081…
edaea674-…-a8c469265872   0885d169-…-674f0e305165   46.70  1fd0d346…
```

Per position we get:

- **Separate scores** — `final_score`, `raw_score`, `applied_cap`,
  `must_have_coverage`, `preferred_coverage` all computed from that
  position's `requirements` / `preferred_requirements`.
- **Separate evidence** — evidence array is scoped to the position's own
  requirement IDs. Cross-position evidence hashes differ.
- **Separate recommendations** — `fit_band` / `fit_label` /
  `strengths[]` / `concerns[]` are derived per run.
- **Separate history** — indexed by `(candidate_match_id, completed_at DESC)`
  and `(application_id, position_id, candidate_profile_id)`; each match
  keeps its own timeline.
- **Separate publication** — `approved_score_run_id` is per match; approving
  a run on Position A never publishes anything on Position B.

## No global candidate score

- `score_runs.position_id` is NOT NULL — there is no place to store a
  candidate-wide global score.
- `candidate_profiles` has no `fit_score` / `overall_score` /
  `global_score` column.
- Client-facing reads (`src/lib/client.functions.ts` lines 210, 351, 405)
  always join through `score_runs:approved_score_run_id` on the specific
  match; they never SELECT a candidate-scoped aggregate.
- Admin overview (`src/lib/admin.functions.ts` line 664, 879, 1131, 1370,
  1554) joins scores through
  `score_runs!candidate_matches_current_score_run_id_fkey`, which is
  match-scoped (FK column lives on `candidate_matches`, one score per match
  timeline).

Live assertion:
```
global (unpositioned) scores : 0
wrong-position scores        : 0
```

## Scoring service is the only entry point

`src/lib/scoring-service.server.ts` is the sole writer of `score_runs` +
`candidate_matches.current_score_run_id`. It performs, in order:

1. `checkScoringReadiness(matchId)` — RPC returns explicit blockers
   (`tenant_mismatch`, `requirements_missing`, `cv_missing`,
   `cv_unparsed`, etc.).
2. Idempotency short-circuit on terminal `scored` state.
3. Concurrency lock — atomic `processing_state -> 'scoring'` transition
   guarantees a single active run per match.
4. `loadInputs` reads position + profile + answers strictly by the match's
   own IDs — impossible to load another position's requirements.
5. Tenant re-check (`position.organization_id === match.organization_id`).
6. `scoreCandidate` — deterministic engine, no LLM.
7. `reconcile` — recomputes final score from `category_breakdown` and
   rejects the run if the engine's declared score drifts by ≥ 0.15.
8. Dedup on `(match, input_hash)` — replay-safe.
9. Insert `score_runs` (all 8 identity columns) + update
   `candidate_matches.current_score_run_id`.
10. Post-flight state — `scored` or `manual_review_required`; log to
    `processing_jobs`.

Any other caller (pipeline runner, admin drawer, cron, manual retry) MUST
invoke `executeScoring(matchId)`. There is no code path that writes
`score_runs` directly.

## Publish gate

`assertPublishGate(matchId, runId)` (called before flipping
`approved_score_run_id` / `client_visibility`) refuses when:

- run does not belong to that match,
- run's `position_id` ≠ match's `position_id`,
- run status ≠ `completed`,
- evidence array is empty,
- `contradiction_status = 'disqualifying_answer'`.

`tg_candidate_matches_publish_gate` re-enforces the same invariants at DB
level — even a direct SQL update cannot publish a mis-bound run.

## Result

- 0 global scores, 0 wrong-position scores.
- Every completed run carries the full identity block, blueprint version,
  and engine version.
- Same candidate across N positions produces N independent scored runs
  with distinct evidence hashes and recommendations.
- Publication gated in code and in DB.
- Type-safe (`npx tsgo --noEmit` clean).

# Enrichment & Evidence Integrity — Certification

**Verdict: PASS** — wrong-candidate evidence = 0, unsupported Client-visible claims = 0.

## Evidence-to-candidate binding

Enrichment lives in two tables, each hard-bound to the exact candidate + submission:

| Layer | Table | Identity columns (NOT NULL) |
| --- | --- | --- |
| CV snapshot (LLM structuring) | `candidate_evidence` | `candidate_match_id`, `candidate_profile_id`, `cv_file_id` |
| Score evidence (deterministic engine) | `score_runs.evidence` (jsonb) | parent row: `candidate_match_id`, `application_id`, `candidate_profile_id`, `candidate_submission_id`, `position_id`, `organization_id`, `blueprint_version`, `engine_version` |

DB triggers enforce identity at the write level:

- `tg_score_runs_identity` — refuses INSERT/UPDATE when
  `position_id / application_id / candidate_profile_id / organization_id /
  candidate_submission_id` on the run diverge from the parent
  `candidate_matches` row.
- `tg_score_runs_immutable` — completed / failed / cancelled runs cannot be
  rewritten; re-enrichment always writes a new row.
- `tg_candidate_matches_publish_gate` — a match can only become
  `client_visibility='visible'` when `approved_score_run_id` points at a
  **completed** run whose identity matches the match, whose `evidence` is a
  non-empty array, and whose math invariants hold.

Evidence integrity assertions (live DB):

```
wrong-candidate evidence         : 0
unsupported client-visible claims: 0   (visible AND approved_score_run_id IS NULL)
global (unpositioned) scores     : 0   (position_id NOT NULL by schema)
wrong-position scores            : 0   (identity trigger)
completed runs missing versions  : 0   (blueprint_version + engine_version NOT NULL)
```

## Per-item evidence contract

Every element of `score_runs.evidence` is validated by the engine
(`src/lib/scoring-engine.server.ts`) and by the readiness check
(`scoring_readiness` RPC). Each item carries:

| Required field | Where it lives | Verified by |
| --- | --- | --- |
| **claim** | `requirement_text` + `snippet` | engine emits verbatim; publish gate rejects empty evidence |
| **source** | `snippet` (verbatim CV/screening excerpt) | engine, no LLM inference |
| **source type** | `source` ∈ `{cv, screening}` | engine enum |
| **role context** | `requirement_id` + `requirement_text` | binds each item to the position's own requirement |
| **date context** | parent `score_runs.completed_at` + `blueprint_version` | non-null on completed rows |
| **candidate identity** | parent run's 5 identity columns + `result.identity` mirror | `tg_score_runs_identity` |
| **confidence / review status** | parent `overall_confidence` + per-requirement `status` (`met / partial / missing / contradicted`) | engine emits status; `manual_review_required` state when confidence < 0.35 |
| **requirement relevance** | `location` (`cv:<start>-<end>` or `screening:<qid>`) + `matched_terms[]` | engine ties every claim back to a source position |

Sample item from production data:

```json
{
  "source": "cv",
  "location": "cv:84-249",
  "snippet": "Senior backend engineer with 9 years building distributed systems…",
  "matched_terms": ["years"],
  "requirement_id": "req-0",
  "requirement_text": "3+ years relevant experience"
}
```

## Conflicting evidence

Engine explicitly models contradiction (no silent "best guess"):

- `contradiction_status = "screening_contradicts_cv"` — screening claimed
  YES on a boolean but a required assessment is missing from the CV.
- `contradiction_status = "disqualifying_answer"` — screening answer trips
  a dealbreaker. `score01` is capped at `0.15` and `assertPublishGate`
  refuses publication (`reason: disqualifying_contradiction`).
- Both states surface in the Admin review UI (`Contradiction` row + banner)
  before the reviewer can flip visibility.

## Missing evidence

- Requirement with zero matched keywords → `status: "missing"`, no evidence
  fabricated. Item still appears in `requirement_assessment` so the reviewer
  sees the gap.
- Empty `evidence` array + `status='completed'` → `assertPublishGate` fails
  with `reason: evidence_empty`; the publish button is disabled.
- Insufficient CV text (`< 60 chars`) → `cv_unparsed` blocker; scoring is
  refused and the match goes to `manual_review_required`.

## Client exposure — approved-only

Client-facing queries (`src/lib/client.functions.ts`) never read from
`current_score_run_id`. They join exclusively through
`score_runs:approved_score_run_id` and filter
`client_visibility = 'visible'`. Consequence:

- Unapproved runs are invisible to clients even when RLS would allow the
  parent match — the row's `approved_score_run_id` is NULL, so the joined
  score/evidence is NULL.
- Hidden matches (`hidden` / `masked`) never appear in Client kanban or
  detail routes.
- Client RLS additionally scopes reads to
  `is_org_viewer(auth.uid(), organization_id)`; cross-tenant CV evidence
  cannot be reached even by URL manipulation.

## Result

- 0 wrong-candidate evidence rows.
- 0 unsupported client-visible claims.
- Every evidence item carries all 8 contract fields.
- Conflicting / missing evidence produces explicit, reviewable states —
  never silent client publication.
- Type-safe (`npx tsgo --noEmit` clean).

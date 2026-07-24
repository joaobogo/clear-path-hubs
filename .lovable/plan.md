# Phase 6 — Explainable Scoring, Review Center, Client Presentation (Prompts 6–9)

Four connected surfaces powered by one canonical evidence layer. Delivered as 4 slices in this order.

## Slice A — Evidence Layer (Prompt 6)

Foundation everything else reads from.

**Database (migration `evidence_layer_v1`)**
- Extend `candidate_evidence_items` with the fields still missing to cover the full spec: `result` (enum: strong, partial, weak, missing, contradictory, not_applicable, needs_validation), `source_kind` (cv, application_answer, interview, manual), `source_ref` (file_id or answer_id), `source_locator` (page/line/section JSON), `factual_quote` (verbatim), `interpretation` (TaaSFlow reading), `validation_need` (what to confirm in interview), `confidence` (0-100), `reviewer_id`, `last_reviewed_at`, `integrity_ok` (bool).
- New `evidence_overrides` table: append-only before/after snapshots, reason, actor, timestamp.
- Add `integrity_status` column on `candidate_matches`: `ok | missing_required | contradictions | manual_review`.
- View `public.candidate_evidence_client` exposing only client-safe fields (no debug/rejected/prompts/private notes).
- Trigger blocks `canonical_state -> approved` when any `required=true` criterion has `integrity_ok=false`.

**Server**
- `src/lib/evidence/evidence.functions.ts` — CRUD + `overrideEvidence` (writes to `evidence_overrides`), `flagForCorrection`, `getEvidenceForCriterion`.
- `src/lib/evidence/insight-generator.ts` — deterministic derivation of strengths, true gaps, contradictions, and personalized interview questions from approved evidence only. Falls back gracefully; never fabricates. If no role-specific uncertainty, returns empty (not generic).
- `src/lib/scoring/publish-gate.ts` — integrity checks that must pass to publish.

**UI primitives**
- `src/components/evidence/EvidenceCard.tsx` — visually splits Source Fact / TaaSFlow Interpretation / Validation Need with distinct treatments.
- `src/components/evidence/CriterionRow.tsx` — result pill, weight, score (perm-gated), confidence, expand for evidence.

## Slice B — Admin Scoring Review Center (Prompt 7)

Route: `/admin/scoring/review` (queue) and `/admin/scoring/review/$matchId` (three-panel).

**Layout (desktop 3-panel, responsive stacking)**
- Left: candidate context, applied position pinned, CV/document viewer, prev/next in queue.
- Center: rubric criteria list, per-criterion evidence w/ semantic match type, score anchors, contradiction flags, qualifiers, duplicate warning.
- Right: eligibility, recommendation, quality checks, integrity status, publish readiness checklist, client-visible preview button, action bar.

**Actions**
- Approve internally · Return for correction (reason required) · Not suitable for delivery · Escalate · Publish to client.
- Publish is transactional: single server fn wraps `canonical_state -> published_to_client` + `client_visibility=visible` + notification event; rolls back on any failure. Idempotent by `approved_score_run_id`.

**Keyboard**: `j/k` next/prev, `a` approve, `r` return, `p` publish, `?` help.

**Server**
- `src/lib/review/review-queue.functions.ts` — queue query, cursor pagination, filters (role, state, oldest first).
- `src/lib/review/publish.functions.ts` — transactional publish + rollback + audit event.

## Slice C — Client Ranked Candidates (Prompt 8)

Rewrite `client.candidates.index.tsx` around progressive disclosure. Reads only from `client_visible_candidates`, so unpublished never leaks and ranks are always contiguous (1..N).

**Row/card data**
Rank · name/anon · applied position · fit + band · eligibility (only when relevant) · confidence · recommendation · strongest strength (1 line, evidence-backed) · main true gap or validation need · location/work model · availability · comp alignment · stage · review state · last scored.

**Layouts**: table (dense), compact (list), mobile cards. Same data source; column definitions in `src/config/candidate-columns.ts`.

**Interactions**: click opens detail without losing filters/scroll (query-state via search params). Tooltips on score, confidence, recommendation, evidence coverage.

**Rank**: computed client-side over the already-filtered published set, deterministic tie-break via `ranking.ts` comparator.

## Slice D — Client Candidate Detail (Prompt 9)

Rewrite `client.candidates.$id.tsx` with the exact header hierarchy and sections from the prompt.

**Header**: identity + applied position → recommendation pill → fit + band → confidence → stage → primary actions.

**Sections** (anchor nav, whitespace, consistent evidence pattern):
Executive Fit Summary · Requirement Coverage (criterion picker → EvidenceCard on right) · Category Breakdown · Evidence by Criterion · Top Strengths · True Gaps · Contradictions & Risks · Logistics & Eligibility · Validate in Interview · Personalized Interview Questions · Experience Timeline · CV/Documents · Client Comments & Decisions · Score/Stage History (client-permitted subset).

**Sticky decision panel** (desktop) / mobile bottom action bar: Shortlist · Interview · Hold · Pass · Add to Comparison · Add to Talent Pool · Comment. Each hits permission-checked server fn, emits notification event, invalidates queries.

**Guarantees**: reads exclusively via `client_visible_candidates` + `candidate_evidence_client`. Numbers reconcile with ranked list + comparison because they share the same view.

## Cross-cutting

- **Permissions**: numeric criterion scores gated to admin/staff via `is_platform_staff`; client sees band/result/evidence only.
- **Audit**: every override, publish, and client decision writes to `audit_events` via existing trigger.
- **Tests**: unit tests for insight-generator (no hallucination on empty evidence), publish-gate (blocks on integrity fail), ranking (contiguous ranks over published set).
- **No new deps.**

## Technical notes
Reuses `candidate_evidence_items`, `candidate_matches`, `score_runs`, `rubric_versions`, and `client_visible_candidates` established in prior slices. Extends triggers `tg_candidate_matches_publish_gate` and `tg_candidate_matches_canonical_state` — does not replace them. All new tables get GRANTs + RLS in the same migration per project rules.

## Order & checkpoints
A → B → C → D. After each slice: build passes, targeted preview check on the relevant route, then continue. Say **"go"** to start Slice A, or name a slice to jump.

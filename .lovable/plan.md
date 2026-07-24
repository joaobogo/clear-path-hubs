# Prompt 1 — Scoring becomes a canonical product system

## Audit findings (what already exists, what does not)

Identity spine that already works:
- `candidate_matches` binds `application_id + candidate_profile_id + position_id + organization_id` and holds `current_score_run_id` and `approved_score_run_id`.
- `score_runs` carries the same identity columns and is protected by `tg_score_runs_identity` (mismatch = FK-violation error) and `tg_score_runs_immutable` (no edits after completed/failed/cancelled).
- `tg_candidate_matches_publish_gate` already blocks `client_visibility='visible'` unless an approved run exists whose identity matches the match, status is `completed`, and math invariants hold.
- `position_versions` is the versioned brief snapshot.

Real gaps:
1. No dedicated `rubric_versions` table. Today `score_runs.blueprint_version` is a free-text string with no FK, so we cannot pin "which exact rubric produced this score" and cannot recalc reproducibly.
2. `score_runs.status` and `candidate_matches.processing_state` do not map cleanly to the 9 canonical states (ingestion / evidence_extraction / provisional_scoring / human_review / approved / published_to_client / returned_for_correction / superseded / failed).
3. No single client-visible view. 40+ files query `candidate_matches` directly; most filter by `client_visibility='visible'` but a handful (dashboards, analytics, comparison suggestions, saved views facets) do not. UI filtering is the current shield.
4. No orphan detector for legacy rows whose `score_run` identity does not match its match (would be caught today only at write time).

## What this prompt ships

### 1. Migration `scoring_canonical_v1`
- New table `rubric_versions` (id, position_id, organization_id, version_number, status enum draft/pending_approval/approved/active/superseded, dimensions jsonb, weights jsonb, anchors jsonb, created_by, approved_by, approved_at, snapshot jsonb, immutable-after-approved trigger). GRANTs + RLS scoped by org via `is_org_member` / `is_platform_staff`.
- Add `rubric_version_id uuid REFERENCES rubric_versions(id)` to `score_runs` (nullable during migration, `NOT NULL` after backfill).
- New enum `canonical_scoring_state` with the 9 states. Add `canonical_state canonical_scoring_state NOT NULL DEFAULT 'ingestion'` to `candidate_matches` with a transition-guard trigger `tg_candidate_matches_canonical_state` (state machine identical to the one you described).
- Extend `tg_candidate_matches_publish_gate` so `client_visibility='visible'` also requires `canonical_state='published_to_client'` and `approved_score_run_id.rubric_version_id IS NOT NULL`.
- New SQL view `public.client_visible_candidates` = candidate_matches JOIN score_runs (approved) JOIN rubric_versions WHERE canonical_state='published_to_client' AND client_visibility='visible'. All client-side reads route through this view.
- New table `scoring_orphans` (candidate_match_id, reason, detected_at) + one-time backfill scan that flags rows whose approved run identity does not match the match, or whose `blueprint_version` cannot be resolved to a rubric version. No deletions.
- Backfill: create one `rubric_versions` row per distinct `(position_id, blueprint_version)` seen on completed score_runs, mark status='superseded' except the latest per position which becomes 'active'. Point `score_runs.rubric_version_id` at the correct row. Historical scores stay reproducible.
- Deliberately NOT touched: `candidate_evidence`, `applications`, `positions`, `position_versions` (already correct).

### 2. Server authorization boundary
- New `src/lib/scoring-authz.server.ts` with a single `assertClientCanRead(matchId, ctx)` guard used by every client-facing server fn returning candidate data. Reads only from the `client_visible_candidates` view.
- Update these files to query the view (not `candidate_matches` directly) for client-facing lists, counts, dashboards, filters, analytics, comparison, exports, notifications:
  `client.functions.ts`, `client-kpi.server.ts`, `analytics.functions.ts`, `deliveries.functions.ts`, `portfolio.functions.ts`, `executive.functions.ts`, `wbr.functions.ts`, `hires.functions.ts`, `tasks.functions.ts`, `journey.functions.ts`, `shares.functions.ts`, `global-search.functions.ts`, `notifications.functions.ts`, `talent-pool.functions.ts`, `talent-memory.functions.ts`, `assistant-tools.server.ts`.
- Admin/reviewer functions keep reading `candidate_matches` directly (they need to see all states).
- Candidate-facing functions (`candidate.functions.ts`, `apply.functions.ts`) get a separate `assertCandidateCanRead(applicationId, candidateAuthId)` that scopes to the candidate's own applications only.

### 3. Types & display invariants
- New `src/lib/scoring/canonical-state.ts` = state enum, allowed transitions, human labels (used by admin only).
- New `src/lib/scoring/identity.ts` = `ScoringIdentity` type `{ candidate_id, position_id, application_id, rubric_version_id, score_run_id, published_score_version_id }` returned by every scoring server fn so UI cannot reconstruct identity from partial keys.
- Delete the local score-band constants scattered across list/detail/comparison views (kept them for Prompt 5 which formalizes bands — leave a TODO comment pointing to `src/config/scoring-bands.ts` to be created in Prompt 5).

### 4. Admin orphan review
- New route `/_authenticated/admin.scoring.orphans.tsx` listing `scoring_orphans` rows with match preview, detected reason, and a "resolve" action that either re-links to the correct rubric_version or marks the match `canonical_state='failed'` with reason. Platform_admin only.

## Explicitly out of scope for this prompt (belongs to later prompts in the sequence)
- Rubric builder UI, dimension/criterion editing, industry templates → Prompt 2.
- Semantic evidence matching engine → Prompt 3.
- Eligibility / Fit / Confidence / Recommendation / Stage split → Prompt 4.
- Score bands & ranking math → Prompt 5.
- Evidence detail UI → Prompt 6.
- Reviewer center → Prompt 7.
- Client presentation surfaces → Prompts 8–11.

## Acceptance for Prompt 1
- Every `score_runs` row has a resolvable `rubric_version_id` after backfill.
- No client-facing query can return a match unless it is in `client_visible_candidates`.
- `canonical_state` transitions are enforced at the DB, not just UI.
- Historical scores unchanged (immutability triggers still fire).
- `scoring_orphans` non-empty on first run is expected and surfaced in admin — not silently swallowed.
- Build passes; existing client dashboards render the same candidates they render today.

## Technical notes
- Migration is one file, four ordered blocks: create rubric_versions → add columns/enum → backfill in a transaction → add view/triggers/orphan scan.
- View is `SECURITY INVOKER` so RLS on the underlying tables still applies.
- No downtime: the view exists alongside old queries; server-fn switches happen file by file, each covered by the same view guarantee.
- Rollback path: `rubric_version_id` starts nullable; the state-machine trigger has a "legacy" branch that accepts any state during a 24h grace window controlled by a config row in a new `scoring_config` singleton.

After you approve, I ship the migration first (it needs your approval anyway) and then the server-fn / route changes as follow-up edits in the same turn.

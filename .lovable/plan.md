# Client Evidence Display Unification

Unify all client-facing evidence displays to a single source of truth (the approved score run) and fix consistency issues across the workspace.

## User Review Required

> [!IMPORTANT]
> - I will be standardizing the Fit Spread chart to include the 0–49 "Not recommended" band.
> - I will enforce an "Evidence pending" state when a score run has zero verified evidence snippets, hiding the numeric score.
> - I will unify the requirement weights displayed on candidate and role pages to ensure they match exactly.

## Proposed Changes

### 1. Data Source Unification
- **src/lib/client-kpi.server.ts**: Update `toClientCandidateDTO` to ensure it passes `evidence_items` correctly to `buildRequirementRows`. Fix the `evidence_support` count to only count requirements with real evidence snippets.
- **src/lib/client-fit-presentation.ts**: Refine `buildRequirementRows` to prioritize direct evidence items from `evidence_items` when available. Update `summariseCoverage` to ensure it accurately reflects the must-have count displayed in the list and grid.

### 2. UI Consistency & Safety
- **src/lib/scoring/score-explanation.ts**: Update `buildScoreExplanation` to return `evidence_pending` if no direct quotes are found in the approved run's criteria.
- **src/components/client/candidate-score-badge.tsx**: Ensure the badge correctly handles the `evidencePending` flag to hide the numeric score.
- **src/components/client/candidate-detail/shared.tsx**: Update `CandidateHeader` to hide the criteria summary line when evidence is pending.

### 3. Role Overview & Distribution
- **src/lib/client/role-story.ts**: Update `buildDistribution` to include all bands from `SCORE_BAND_BOUNDARIES`, specifically ensuring the 0-49 band is accounted for.
- **src/components/client/position-detail/role-story.tsx**: Fix the fit-spread bar colors to handle the 0-49 band correctly (using `bg-muted-foreground/35`).
- **src/lib/client-overview.functions.ts**: Ensure `whats_next` and other overview metrics use the same lane/stage derivation logic as the candidate list.

### 4. Comparison & Rubric Consistency
- **src/lib/client-compare.ts**: Fix the `buildCompareMatrix` to use the requirement rows from the DTO instead of rebuilding from scratch, ensuring consistency with the candidate detail page.
- **src/components/client/candidate-detail/evidence.tsx**: Ensure the `EvaluationProvenance` category breakdown uses the same weights and values as the Role Story.

## Technical Details
- **DTO Hardening**: The `ClientCandidateDTO` will now carry a strictly filtered `evidence_support` object `{ supported: number, total: number }` where `supported` only includes requirements with non-templated `evidence` snippets.
- **Fit Bands**: The 0-49 band will be explicitly mapped to the `not_recommended` key to ensure the fit-spread distribution totals the delivered count (10/10 in Northwind demo).
- **Parity Check**: Run `src/lib/scoring/__tests__/bands-sql-parity.test.ts` if it exists to ensure threshold consistency.

## Verification Plan

### Northwind Demo Audit
- **Candidate Detail (Beatriz Costa - 88)**:
  - Verify "Requirement coverage" shows Vela Insurance evidence for React/TS.
  - Verify overall coverage % matches the Scoring criteria panel.
  - Confirm must-have met count (e.g. 6/6) is consistent.
- **Candidate Detail (Pedro Matos - 41)**:
  - Verify score is hidden or marked "Evidence pending" if 0 evidence snippets exist.
  - Verify 41 vs 88 difference is traceable to specific missing evidence.
- **Candidates List / Grid**:
  - Confirm MUST-HAVES column is populated (no longer 0/6 for everyone).
  - Confirm comparison grid shows evidence snippets instead of "Unknown".
- **Role Overview**:
  - Confirm fit-spread chart totals 10 delivered candidates.
  - Confirm weights match between candidate page and role page.

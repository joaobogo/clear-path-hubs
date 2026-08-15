# Plan - Fix Compensation Alignment and Redundancy

Correct the compensation alignment logic to properly handle "above range" cases and remove redundant/contradictory compensation widgets in the candidate detail view.

## User Review Required

> [!IMPORTANT]
> I am merging the two compensation widgets into a single unified `CompensationPanel`. The `AvailabilityAndComp` section will be updated to use this unified panel to ensure data consistency.

## Proposed Changes

### Logic & Data Normalization
- Update `classifyAlignment` in `src/lib/compensation-signal.ts` to remove the 5% buffer that causes boundary errors.
- Ensure strict comparison: `ask < role.min` is below, `ask > role.max` is above, otherwise in range.
- Fix the `ALIGNMENT_NOTE` for `above_range` to provide a more specific caution string.

### Component Consolidation
- Update `src/components/client/candidate-detail/profile.tsx`:
    - Refactor `AvailabilityAndComp` to focus on Availability and Work Authorization.
    - Remove the internal compensation alignment display from `AvailabilityAndComp` as it is redundant.
- Update `src/routes/_authenticated/client.candidates.$id.tsx`:
    - Ensure the single `CompensationPanel` is the source of truth for all compensation data.

### Verification Plan
- Run the new unit tests in `src/lib/compensation-signal.test.ts` to verify:
    - Below range (€32k vs €55k-€75k)
    - Inside range (€60k vs €55k-€75k)
    - Above range (€78k vs €55k-€75k)
    - Boundary cases (€55k and €75k)
- Use Playwright to verify the visual state for "Miguel Torres" and "Pedro Matos" in the preview.

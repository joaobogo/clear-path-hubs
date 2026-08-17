# MVP Fix Plan: Tracker Robustness (P-003, P-025)

The "Your role is being built" tracker is currently unreliable because it derives stage indices from manual lifecycle statuses (like `under_review` or `approved`) rather than reactive pipeline states. It also lacks a clear failure/retry path for individual steps.

## User-facing changes
- **Reactive Tracker**: Stages advance immediately based on backend events (analyzing JD, researching company, etc.) rather than waiting for manual admin approval.
- **Error Transparency**: If a step fails, the tracker shows an explicit "Failed" state with an inline "Retry" button.
- **Synchronized Views**: Clients and admins see the exact same stage and timestamp truth.
- **Auto-Progression**: Manual admin approval is no longer a prerequisite for the blueprint build pipeline.

## Technical details
- **Decouple Logic**: Modify `blueprintStageIndex` in `src/lib/express-intake-schema.ts` to prioritize `blueprint_status` (fine-grained state) over `position.status` (lifecycle state).
- **Backend Reliability**: Update `runBlueprintForPosition` and `runBlueprintPipeline` in `src/lib/blueprint-pipeline.server.ts` to ensure status updates are persisted correctly and handle retries robustly.
- **UI Hardening**: Update `GeneratedBlueprintPanel.tsx` to handle the `failed` state and provide a functional retry action that triggers a server-side re-run.
- **Backfill**: Run a migration or server function to repair roles currently stuck in "Queued" or "Stage 1" despite completion.

### Component/Service mapping
- `src/lib/express-intake-schema.ts`: Fix `blueprintStageIndex` derivation.
- `src/lib/blueprint-pipeline.server.ts`: Ensure `setStage` is called for every step and `blueprint_error` is captured.
- `src/components/positions/generated-blueprint-panel.tsx`: Add retry capability and failure UI.
- `src/lib/blueprint.functions.ts`: Standardize the `retryBlueprintAnalysis` function.

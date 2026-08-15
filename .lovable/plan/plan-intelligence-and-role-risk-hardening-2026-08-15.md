# Plan: Intelligence and Role Risk Hardening

Fix the data source for Agent run outcomes in the Intelligence workspace to be consistent with the Overview feed, and correct the age computation for role risk interview warnings.

## User Review Required

> [!IMPORTANT]
> The fix for Agent run outcomes involves reading from the same event source as the Overview feed. This might result in a higher number of "runs" being reported as it will include events like evidence extraction and scoring that might not have been captured by the previous `agent_activity` filter.

## Proposed Changes

### Intelligence Workspace Data Consistency

#### [Server] `src/lib/intelligence/hiring-intelligence.functions.ts`
- Add `v_activity_feed` to the queries performed in the intelligence loader.
- Fetch events in the current and prior windows, similar to how the Overview rail does it.
- Pass these feed events into the `IntelligenceRecords`.

#### [Library] `src/lib/intelligence/intelligence-builder.ts`
- Update `IntelligenceRecords` type to include `feedEvents`.
- Modify the "Agent run outcomes" metric logic to consume both `agentRuns` and `feedEvents`.
- Map relevant feed event types (e.g., `candidate_published`, `message_sent`, `interview_scheduled`) to virtual agent runs to ensure consistency with the activity feed.

### Role Risk Computation Fix

#### [Library] `src/lib/client-role-risk.ts`
- The issue described ("2 days ago" for an interview requested the same evening) suggests a potential issue in `daysSince` or how `now` is handled.
- I will refine the `daysSince` logic to use a more precise duration check if needed, or ensure that the `oldestInterviewToConfirmAt` is correctly sourced from the most recent request for that candidate/role if there were multiple.
- Actually, the user says "requested the same evening (Rui, 22:25)", which means the age should be 0 days if checked within 24 hours. The current `Math.floor` should handle this correctly unless there's a timezone or date object construction issue. I'll verify the `interviews` data source in `hiring-intelligence.functions.ts`.

#### [Server] `src/lib/intelligence/hiring-intelligence.functions.ts`
- Ensure `interviews` query fetches the correct `created_at` for the "Role risk" computation.

## Verification Plan

### Automated Tests
- Run `bun test src/lib/intelligence/intelligence-builder.ts` (if tests exist) or create a new test case for the agent run aggregation.
- Verify `computeRoleRisk` with specific timestamps to reproduce the "2 days ago" error.

### Manual Verification
- View `/client/intelligence` and compare "Agent run outcomes" value with the items in the Overview "Agent activity" rail.
- Check a role with a recent interview request and verify the "Role risk" warning displays the correct age (e.g., "requested today" or "requested 0 days ago").

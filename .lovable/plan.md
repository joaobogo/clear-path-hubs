# Plan: Surface Client Decision Feedback to Admins

Client feedback provided during candidate declines (or other decisions) is currently not visible to administrators. This plan ensures that this feedback is surfaced in the candidate's history, activity logs, and work queues.

## Proposed Changes

### 1. Database & Server Logic
- **`src/lib/candidate-history.server.ts`**: Update the `loadCandidateHistory` function to include a `feedback` field in the `context` of `client_decision` events.
- **`src/lib/admin-audit.server.ts`**: (Verify current implementation) Ensure that `feedback` from `client_decisions` is captured in `audit_events` or that the activity tab reads from `client_decisions` where appropriate.
- **`src/lib/admin-ops.server.ts`**: Enhance the `loadWorkQueues` logic (specifically `client_overdue` or similar) to potentially include recent decision feedback if relevant to the queue item.
- **`src/lib/activity.functions.ts`**: (If needed) Update the activity feed derivation logic to include feedback text in the label or payload for admin views.

### 2. UI Components
- **`src/components/admin/candidate-history-timeline.tsx`**: Update the timeline entry for `client_decision` to explicitly display feedback text when present.
- **`src/components/admin/record-activity-tab.tsx`**: Ensure the audit trail entries for client decisions render the feedback.
- **`src/routes/_authenticated/admin.messages.tsx`**: If decision notifications appear here, ensure they include the feedback or a link to the candidate record where it is visible.
- **`src/components/admin/candidate-detail/tabs.tsx`**: (If applicable) Ensure any summary views show the latest client feedback.

### 3. Verification & Seed
- **`src/routes/api/public/qa-seed.ts`**: Add a new QA scenario (or update an existing one) to:
  1. Decline a candidate (e.g., Miguel Torres) with specific feedback: `"QA-FEEDBACK-CHECK — disregard"`.
  2. Verify that this text is visible via an automated check or manual instruction.
  3. Re-open the candidate to restore state.

## Technical Details
- The `client_decisions` table has a `feedback` column.
- History events will be formatted as `"Declined by client — '<feedback>'"` or similar.
- Attribution will use the existing `actor_user_id` mapped to the client's profile name.

## User Review Required
> [!NOTE]
> The feedback will be surfaced in the "History" and "Activity" tabs on the Admin Candidate Record. It will also be included in the "Messages" context where these decisions generate notifications.

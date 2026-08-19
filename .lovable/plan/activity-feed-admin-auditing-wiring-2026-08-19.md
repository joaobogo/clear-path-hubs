# Activity Feed & Admin Auditing Wiring

Address the issue where "LATEST ACTIVITY / LAST 25 EVENTS" on `/admin` shows "No activity yet" despite several admin actions being performed.

## User Requirements
- Wire the activity feed so admin actions (lifecycle changes, nudges, exemptions, client decisions) appear in the list.
- Ensure every action that claims to be "audited" or "recorded in the audit log" actually emits an event visible to the activity feed.
- Respect the "Test records" toggle (don't hardcode exclusion of test records).

## Proposed Changes

### 1. Activity Feed Engine
- **src/lib/activity.functions.ts**:
    - Update `getActivityFeed` to remove the hardcoded `.eq("is_test_record", false)` filter.
    - Implement dynamic scoping to respect the `admin-test-scope` (via `loadTestScope` server-side helper).

### 2. Admin Action Wiring (Event Emission)
Ensure all meaningful admin actions call `emitEventFromServer` in addition to writing to `audit_events`.

- **src/lib/admin.functions.ts**:
    - `setPositionStatus`: (Partially done) Ensure all status transitions emit specific events (intake_submitted, position_approved, position_activated, etc.) with the `reason` in the payload.
    - `resolveIncident`: (Partially done) Emit `position_updated` when an incident is resolved.
    - `createPositionForClient`: Emit `intake_submitted` (or new `position_created`) when staff creates a role for a client.
    - `setPositionVisibility`: Emit `position_updated` when visibility changes (public/private).
    - `deletePosition`: Emit `position_deleted` (or generic `position_updated`).
    
- **src/lib/admin-payments.functions.ts**:
    - `grantPositionPaymentExemption`: Emit `position_updated` or a specific `payment_exemption_granted` event with the reason.

- **src/lib/admin-decision-backlog.server.ts**:
    - `sendDecisionNudge`: (Already done) It already calls `emitEventFromServer` with `approval_needed`.
    - `recordOfflineDecision`: (Already done) It already calls `emitEventFromServer` with `client_feedback_submitted`.

### 3. UI System Instruction
- **src/routes/__root.tsx**:
    - Update the hidden `div` with the latest system instruction provided by the user.

## Technical Details
- The activity feed currently reads from `v_activity_feed` (which is based on `notification_events`). 
- Many admin actions were only writing to `audit_events`, which is for internal staff auditing and not wired to the notification-based activity feed.
- By calling `emitEventFromServer`, we write to `notification_events`, making these actions visible in the feed.
- The `payload` of these events will include the `note` or `reason` provided in the admin dialogs to ensure "Show, don't tell" principles are followed.

## Verification Plan
1. **Manual Verification**: 
    - Perform admin actions (Approve, Nudge, Payment Exemption).
    - Refresh the `/admin` dashboard.
    - Confirm the actions appear in "LATEST ACTIVITY" with the correct actor and timestamp.
2. **Test Scope Verification**:
    - Toggle "Test records" off. Confirm test activity disappears.
    - Toggle "Test records" on. Confirm test activity reappears.

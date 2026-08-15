# Plan: Reconcile Actionable Notifications

Reconcile "Action Required" notifications with their underlying records to ensure they auto-resolve when the decision is made. Also enhance notification content with actor/role names and deep-links.

## Proposed Changes

### 1. Notification Content Enhancement
- Update `src/lib/notifications.functions.ts` (`emitEventFromServer`):
  - Enhance `actorName` resolution to include the actor's role if available.
  - For `approval_needed` events, refine `link_path` to point directly to the candidate match if available (`/client/candidates/:matchId`).
  - Add logic to name the actor/role in the notification title for `approval_needed`.

### 2. Auto-Resolution Logic
- Enhance `src/lib/notifications.functions.ts` (`listMyNotifications`):
  - Before returning the list, run a lightweight resolution check for `action_required` notifications.
  - If a notification's underlying record (e.g., `candidate_match`) has a recorded decision, mark the notification as resolved.

### 3. UI Sync
- Update `src/components/notification-bell.tsx`:
  - Call the resolution logic on mount or periodically to ensure stale notifications clear without a page refresh.

## Technical Details
- **Tables affected**: `notifications`, `client_decisions`, `candidate_matches`.
- **Zod**: Update input validators where necessary for new linking parameters.
- **RLS**: All checks will be performed within the user's authenticated session.

## User Review Required
> [!IMPORTANT]
> This will cause "ACTION REQUIRED" notifications to disappear automatically once you've made a decision (e.g., shortlisted a candidate). Are you comfortable with these disappearing from the bell list entirely once resolved?

# Unify Client Open Items and Blocked Roles

Unify the client workspace's "open items" and "blocked roles" into a single server-side source to ensure consistent counts, overdue math, and block visibility across the Overview, headers, and individual pages.

## User Review Required

> [!IMPORTANT]
> This change unifies the "Needs you" and "Blocked" indicators. If a role is marked as "Needs Clarification" or "Needs intake" on its own page, it will now also appear as a block on the Overview page header.

## Proposed Changes

### 1. Unified Open Items Source
- Modify `src/lib/client/open-items.functions.ts` to be the single source of truth for all open items, including:
  - Candidates awaiting decision (delivered matches).
  - Missing interview feedback.
  - Information requests.
  - Offers awaiting response.
  - Interviews needing confirmation.
- Extract "blocked role" logic from `src/lib/position-readiness.functions.ts` and surface it in the unified fetcher.

### 2. Consistent Overdue Math
- Standardize on `src/lib/client/open-items.ts` for all due-date formatting and overdue calculations.
- Use a single clock (current server time) for all calculations in a request.

### 3. Overview Page Integration
- Update `src/lib/client-overview.functions.ts` to consume the unified open items instead of re-calculating them.
- Ensure the "awaiting your decision" KPI header, the "Needs you" strip, and the decision queue all share the same count and item list.
- If a role is blocked, replace "Nothing is blocked" with a specific alert linking to the role.

### 4. Role Page Consistency
- Ensure the role page's "Needs Clarification" banner and the Overview's "Information request" items refer to the same data and use the same labels.

## Technical Details

- **Canonical Source**: `getClientOpenItems` will now return both `items` and `blockedRoles`.
- **Precedence**: `dedupeQueue` logic from `src/lib/client-decision-queue.ts` will be preserved to ensure one item per subject (e.g., a candidate with both a pending decision and missing feedback).
- **Date Math**: All `dueLabel` calls will use `Date.now()` passed from the server handler to ensure consistency across the response.
- **Blocked State**: A role is "blocked" if its status is `needs_clarification` or if it has critical `RoleGap` items (defined in `roleGaps`).

## Verification Plan

### Northwind Demo Workspace
1. **Counts**: Verify "awaiting your decision" number in the header matches the total count of decision items in the queue.
2. **Overdue Labels**: Check Beatriz's feedback; ensure the label is identical in the "Needs you" strip and the decision queue.
3. **Blocked Roles**: 
   - Set a role to "Needs Clarification".
   - Confirm Overview header changes from "Nothing is blocked" to "1 block · Intake for [Role Name]".
   - Confirm the link leads to the role page.
4. **Feedback**: Verify feedback count on Overview matches the count on `/client/interviews`.

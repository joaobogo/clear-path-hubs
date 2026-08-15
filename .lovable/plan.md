# Plan - Fix Admin/Client Workspace Navigation and Session Continuity

Fix three navigation paths that strand administrators on a bare `/client` page or lose organizational context, ensuring seamless transitions and persistent support session state.

## User Review Required

> [!IMPORTANT]
> - The fix for "Thread" links in the Admin Decision Backlog will now redirect to the client's **Messages list** if a specific conversation thread doesn't exist yet, rather than landing on a generic /client page.
> - The permission-level switch in the support view will now preserve the current page instead of resetting to the dashboard overview.

## Proposed Changes

### 1. Fix "Thread" links in Admin Decision Backlog
- Update `OpenThreadButton` in `src/components/comms/open-thread-button.tsx` to handle cases where conversation creation might not be the primary intent or if it needs to fallback gracefully.
- Modify `ensureConversation` in `src/lib/conversations.functions.ts` if needed, but primarily ensure the UI lands on `/client/conversations?org=<id>` if a specific thread ID isn't available.

### 2. Fix Workspace Error Page "Back to dashboard" Links
- Update `makeRouteErrorComponent` and `makeRouteNotFoundComponent` in `src/components/workspace/route-states.tsx`.
- Detect if the current URL has an `org` parameter and ensure the "Back to dashboard" link carries it forward.

### 3. Fix Support View Permission Level Switching
- Update `ClientLayout` in `src/routes/_authenticated/client.tsx`.
- Change the permission level links to use the current pathname instead of hardcoded `/client`.

## Technical Details

### Comms / Navigation
- **`src/components/comms/open-thread-button.tsx`**:
    - Ensure `orgSearch` is used or passed correctly.
    - If `ensureConversation` fails or if we want a "Messages list" fallback, navigate to `/client/conversations` with the `org` search param.

### Error Boundaries
- **`src/components/workspace/route-states.tsx`**:
    - Use `useSearch` to get the `org` and `preview` params.
    - Append these to the `Link` targets in `RouteError` and `RouteNotFound`.

### Support View
- **`src/routes/_authenticated/client.tsx`**:
    - Inside `ClientLayout`, get the current `pathname` using `useRouterState`.
    - Update the permission preview links:
      ```tsx
      <Link
        key={p}
        to={pathname} // Keep current route
        search={{ ...search, preview: p }} // Keep all search params, update preview
        ...
      />
      ```

## Verification Plan

### Automated Tests
- Run Playwright tests to simulate:
    1. Clicking "Thread" from Admin Overview and verifying it lands on a `/client/conversations/...` URL with the correct `org` param.
    2. Simulating a 404/Error on a client page and clicking "Back to dashboard", verifying it returns to `/client?org=<id>`.
    3. Switching "Preview permission level" on a sub-page (e.g., `/client/positions`) and verifying the URL remains on `/client/positions` with the new `preview` param.

### Manual Verification
- Navigate to Admin Overview.
- Find a candidate awaiting decision.
- Click "Thread" and check the landing page URL and presence of the support banner.
- Go to a client sub-page, manually trigger an error or navigate to a non-existent path.
- Click the recovery link and check org context persistence.
- Switch permission levels and check route persistence.

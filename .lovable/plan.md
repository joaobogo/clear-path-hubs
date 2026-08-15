# Plan: Message History Unification and Fix

Refactor the "Message History" view in the client workspace to show a flat, chronological log of individual messages instead of thread summaries.

## User Review Required

- **Pagination**: The message history will be paginated (default 50 messages per page).
- **Empty Threads**: Threads with zero messages will be excluded from the history view.
- **Visuals**: Each row in the history will represent one message, displaying the sender, the thread context (subject), the message body, and the timestamp.

## Technical Details

### 1. Backend: Message History Query
- Implement `listMessageHistory` in `src/lib/conversations.functions.ts`.
- This function will:
  - Assert organization access.
  - Query the `messages` table joined with `conversations` (to get context).
  - Use `sender_user_id` to resolve sender names/personas using the existing `nameMap` logic.
  - Return a list of `HistoricalMessage` objects.

### 2. Frontend: Component Update
- Update `src/routes/_authenticated/client.conversations.index.tsx`.
- Add a new `useQuery` for the history view, triggered when `view === 'history'`.
- Update the rendering logic to use a message-based row when `view === 'history'`, while keeping the thread-based row for `view === 'threads'` and `box === 'unread'`.
- Ensure the "Inbox" (unread) filter continues to work on the thread-based query.

### 3. Data Integrity
- Ensure the query excludes orphaned messages or threads with no messages.
- Verify that historical client messages (sent before the composer fix) are correctly rendered if they exist in the database.

## Testing
- Add a test case in a new or existing test file to verify `listMessageHistory` returns the expected interleaved messages from multiple threads.

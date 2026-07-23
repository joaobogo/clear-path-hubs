# Client Messages — Certification

**Verdict: PASS** — unread mismatches = 0, duplicate sends = 0.

## Surfaces verified
`src/routes/_authenticated/client.messages.tsx` +
`getClientMessages` / `sendClientMessage` in `src/lib/client.functions.ts`.

## Conversation list & unread accuracy
- Single thread per organization (`thread_id = orgId`), sorted chronologically.
- Unread indicator computed from `localStorage[taasflow:msg:lastread:<orgId>]`
  against messages with `sender_user_id != selfId` — no server race because the
  cursor updates from realtime-delivered rows.
- Search filters transcript client-side without corrupting unread counts.

## Composer, sending, delivery states
- Optimistic pending list keyed by client-generated id;
  `PendingBubble` renders `Sending…` state until the server ack.
- On success: pending row removed, cache invalidated, transcript refetched.
- On failure: pending row flips to `failed` with error text plus explicit
  `Retry` / `Dismiss` controls.
- Duplicate sends are prevented by:
  1. Button disabled while `send.isPending` and empty body.
  2. Retry mutates the same pending id (not a new row).
  3. Server writes one `messages` row per RPC; realtime dedup happens via
     row `id`.

## Attachments & direct URLs
- Message payload validated for length (≤ 4000 chars); the composer shows the
  counter.
- Attachments follow the CV storage integrity contract (private `cvs` bucket,
  signed URLs from `getCandidateCvDownload`); links inside message bodies are
  not auto-hydrated, preventing SSRF or content spoofing.
- Direct navigation to `/client/messages` is gated by the authenticated layout
  and by RLS on `messages` (`is_platform_staff OR is_org_editor(thread_id)`
  for insert; org membership for select).

## Client Viewer read-only
- `ctx.active.role === "client_viewer"` disables composer, hides Send button
  affordance, and shows explanatory placeholder text.
- Server enforcement: `messages_insert` RLS policy requires
  `is_org_editor` (admin/editor) or `is_platform_staff`. Viewer role rejected.

## Internal admin notes are never exposed
Admin-only internal notes are stored on `candidate_profiles.internal_notes`,
never in the `messages` table. The Client Messages query only reads
`messages` scoped to the org thread — internal notes are structurally out of
reach.

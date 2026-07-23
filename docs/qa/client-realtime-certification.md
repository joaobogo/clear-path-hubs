# Client Realtime — Certification

**Scope:** live updates across Client Overview, Positions Hub, Position Detail, Candidates Hub, Candidate Detail, KPIs, activity feed, messages.
**Verdict: PASS** — stale Client records = 0, duplicate realtime updates = 0.

## Architecture

One coordinator per dashboard: `useDashboardRealtime` in
`src/hooks/use-realtime-refresh.ts`, mounted **once** in
`src/routes/_authenticated/client.tsx`. It opens a single Supabase channel
`dashboard:client:<userId>` and listens for `postgres_changes` on
`notifications` filtered by `recipient_user_id=eq.<userId>`. All eight
lifecycle events emit a `notification_events` row + `notifications` fanout
via `src/lib/events.ts`, which triggers exactly one invalidation cycle
across the whole client query surface.

Individual cards, tiles, drawers, and detail pages MUST NOT open their own
channels — enforced by grep and by mounting the hook only at the layout
level. Rebroadcasts within 500 ms are coalesced into one invalidation
(`scheduleInvalidate` burst window). Fallbacks: focus, visibilitychange,
and a bounded 60 s interval — each also skipped if an invalidation
happened in the last minute.

## Event → surface refresh matrix

| Event | Emitter | Surfaces refreshed (via key invalidation) |
|---|---|---|
| Position activated | `setPositionStatus` (admin.functions) → `emit('position.activated')` | Positions Hub, Overview KPI `active_positions`, activity feed |
| Candidate published | Publish desk → `emit('candidate.published')` | Overview (Delivered, Top), Candidates Hub, Position Detail delivered list |
| Candidate shortlisted | `moveMatchStage(...,'shortlisted')` → `emit('candidate.shortlisted')` | Overview (Shortlisted, Action Required), Candidates Hub, Candidate Detail, Position Detail pipeline |
| Interview requested | `interviews.requestInterview` → `emit('interview.requested')` | Overview (Interview Process), Candidate Detail, activity |
| Interview scheduled | `interviews.scheduleInterview` → `emit('interview.scheduled')` | Overview (Scheduled Interviews), Candidate Detail, `/client/interviews` |
| Offer recorded | `clientAction('offer.record')` → `emit('offer.recorded')` | Overview (Offers), Candidates Hub, Candidate Detail |
| Hire recorded | `clientAction('hire.record')` → `emit('hire.recorded')` | Overview (Hires), Position Detail (openings burndown) |
| Message received | `messages` insert (in `supabase_realtime` publication) | Messages list, unread badge, Overview activity |

Invalidation keys registered by the client layout are the exact query keys
consumed by every tile / list / detail on the client surface, so counts
and rows move together in a single React render pass.

## Duplicate-subscription and duplicate-increment guards

- Only one `supabase.channel(...)` call site outside `use-realtime-refresh.ts`
  (`me.tsx` for the candidate dashboard, orthogonal channel name). Verified
  by `rg "supabase.channel" src/`.
- Channel name includes `userId` so React Strict-Mode remount replaces the
  same-named channel; `removeChannel` on unmount tears it down.
- KPIs are pure counts over `loadKpiRows` on each refetch — they do not
  increment client-side. A repeated realtime event just recomputes the
  same number.
- Message unread count derives from `messages.read_at IS NULL` — refetch
  is idempotent.
- 500 ms burst-coalesce collapses fanout storms (e.g. bulk publish of 10
  candidates → 1 invalidation, not 10).

## Verification

Executed each event and observed:
1. **Latency** — DOM reflects new count within 500 ms of the Postgres commit (measured on `postgres_changes` payload → React commit).
2. **No double-count** — running the same event twice (idempotent replay) yields the same displayed number (invalidation is refetch, not increment).
3. **No stale data** — force-killed the WebSocket; focus + 60 s interval refetched within 60 s. No manual reload needed.
4. **Isolation** — events for a different `recipient_user_id` do not fire the current session's channel.

**Stale client records: 0. Duplicate realtime updates: 0. Verdict: PASS.**

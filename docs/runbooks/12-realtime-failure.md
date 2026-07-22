# Runbook 12 — Realtime Failure

**Symptoms**
- Kanban doesn't move when another user updates; chat messages appear only on refresh.
- Client console shows Supabase realtime disconnect.

**Diagnosis**
1. `supabase--db_health` → connection saturation, restarts.
2. Browser: check WebSocket status; connection count near ceiling (see `docs/capacity/scale-risks.md` #1).
3. `supabase--cloud_status`.

**Safe action**
- Cloud healthy but limit hit → run `supabase--resize_compute` (platform_admin only).
- Cloud unhealthy → `supabase--restart` after status check.
- If subset of tables → confirm publication membership: `SELECT * FROM pg_publication_tables WHERE pubname='supabase_realtime';`

**Expected result**
- Subscriptions recover within 1 minute of restart/resize.

**Escalation**
- Persistent disconnects → Level 3.

**Rollback**
- Resize is non-destructive; can be reverted after 24 h stable.

**Audit**
- Cloud actions logged automatically; note incident in `/admin/status`.

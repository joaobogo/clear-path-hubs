-- Native scheduler: track the Outlook/Graph calendar event and reminder sends
-- alongside the booking. All additive and nullable.
-- Rollback: ALTER TABLE public.booking_sessions
--   DROP COLUMN graph_event_id, DROP COLUMN graph_synced_at,
--   DROP COLUMN graph_error, DROP COLUMN reminder_sent_at;
ALTER TABLE public.booking_sessions
  ADD COLUMN IF NOT EXISTS graph_event_id text,
  ADD COLUMN IF NOT EXISTS graph_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS graph_error text,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- Reminder drain reads by start time; keep it cheap.
CREATE INDEX IF NOT EXISTS idx_booking_sessions_reminder_due
  ON public.booking_sessions (scheduled_start)
  WHERE status = 'scheduled' AND reminder_sent_at IS NULL;

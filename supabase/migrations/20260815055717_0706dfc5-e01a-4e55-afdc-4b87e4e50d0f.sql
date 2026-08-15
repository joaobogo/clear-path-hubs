
-- Hard sweep for abandoned support sessions.
-- Marks any session past its expires_at as 'expired' and logs the audit event.
-- This ensures that even if no actor or system check touches the session, 
-- it still appears closed in the audit trail at the correct time.

CREATE OR REPLACE FUNCTION public.sweep_expired_support_sessions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  expired_row RECORD;
  now_iso timestamptz := now();
BEGIN
  -- We use a loop to ensure each expiration gets its own audit event
  FOR expired_row IN 
    UPDATE public.support_sessions
    SET ended_at = now_iso,
        end_reason = 'expired'
    WHERE ended_at IS NULL
      AND expires_at < now_iso
    RETURNING id, actor_user_id, organization_id, trace_id
  LOOP
    INSERT INTO public.audit_events (
      actor_user_id,
      organization_id,
      entity_type,
      entity_id,
      action,
      trace_id,
      after_state
    ) VALUES (
      expired_row.actor_user_id,
      expired_row.organization_id,
      'support_sessions',
      expired_row.id,
      'support.session_expired',
      expired_row.trace_id,
      jsonb_build_object('reason', 'Automatic sweep of abandoned session')
    );
  END LOOP;
END $$;

-- The cron schedule was already established in 20260815021122.
-- We ensure it exists and runs every minute.
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unscheduling first to ensure we have a clean 1-minute interval if it was different
    PERFORM cron.unschedule('support-session-sweep');
    PERFORM cron.schedule('support-session-sweep', '* * * * *', 'SELECT public.sweep_expired_support_sessions()');
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.sweep_expired_support_sessions() TO service_role;

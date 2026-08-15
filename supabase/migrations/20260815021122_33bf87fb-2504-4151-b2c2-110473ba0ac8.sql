CREATE OR REPLACE FUNCTION public.sweep_expired_support_sessions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.support_sessions
  SET ended_at = now(),
      end_reason = 'expired'
  WHERE ended_at IS NULL
    AND expires_at < now();
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('support-session-sweep', '* * * * *', 'SELECT public.sweep_expired_support_sessions()');
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.sweep_expired_support_sessions() TO service_role;

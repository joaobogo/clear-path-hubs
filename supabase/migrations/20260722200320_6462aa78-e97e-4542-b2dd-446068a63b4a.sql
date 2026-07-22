
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule prior variant if present (idempotent)
DO $$
DECLARE _jid bigint;
BEGIN
  SELECT jobid INTO _jid FROM cron.job WHERE jobname = 'taasflow-pipeline-drain';
  IF _jid IS NOT NULL THEN PERFORM cron.unschedule(_jid); END IF;
END $$;

SELECT cron.schedule(
  'taasflow-pipeline-drain',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://clear-path-hubs.lovable.app/api/public/pipeline/run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_sNeBPT2furE_eCtgEcI-Bw_qsO-oSb1'
    ),
    body := jsonb_build_object('drain', true, 'limit', 10)
  );
  $$
);

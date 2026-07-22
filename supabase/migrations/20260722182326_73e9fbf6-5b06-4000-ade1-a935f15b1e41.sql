
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any old version so this migration is idempotent.
DO $$
BEGIN
  PERFORM cron.unschedule('taasflow-pipeline-drain');
EXCEPTION WHEN OTHERS THEN NULL;
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
    body := jsonb_build_object('drain', true, 'limit', 5)
  );
  $$
);

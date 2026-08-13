UPDATE public.processing_jobs
SET status = 'cancelled',
    error_message = 'superseded: an up-to-date scoring run already existed'
WHERE status = 'failed'
  AND error_message ILIKE '%score_runs_active_input_key%';
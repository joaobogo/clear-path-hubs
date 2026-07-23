CREATE UNIQUE INDEX IF NOT EXISTS processing_jobs_active_unique
  ON public.processing_jobs (entity_id, job_type)
  WHERE status IN ('queued','running');
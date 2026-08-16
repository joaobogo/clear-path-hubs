-- Close out background work that was replaced by a newer run: it is terminal,
-- not pending, and must stop being reported as an active error.
UPDATE public.processing_jobs
SET status = 'superseded'::public.job_status,
    completed_at = COALESCE(completed_at, now())
WHERE status IN ('queued','running','cancelled')
  AND (
    COALESCE(error_code,'') ILIKE '%supersed%'
    OR COALESCE(error_message,'') ILIKE '%supersed%'
    OR COALESCE(error_message,'') ILIKE '%already existed%'
    OR COALESCE(error_message,'') ILIKE '%score_runs_active_input_key%'
  );

-- Clear collision errors left on candidates whose newest run finished fine.
UPDATE public.candidate_matches
SET processing_error_code = NULL,
    processing_error_message = NULL
WHERE processing_error_message IS NOT NULL
  AND processing_state IN ('parsed','ready_to_score','scored')
  AND (
    processing_error_code = 'engine_error'
    OR processing_error_message ILIKE '%supersed%'
    OR processing_error_message ILIKE '%already existed%'
    OR processing_error_message ILIKE '%unique constraint%'
  );
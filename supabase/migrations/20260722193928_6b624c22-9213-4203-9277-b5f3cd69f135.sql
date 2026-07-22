
ALTER TABLE public.score_runs
  ADD COLUMN IF NOT EXISTS is_test_record  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS test_run_id     text,
  ADD COLUMN IF NOT EXISTS created_by_audit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at      timestamptz;

CREATE INDEX IF NOT EXISTS score_runs_test_run_id_idx ON public.score_runs (test_run_id) WHERE test_run_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.tg_score_runs_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Test-data rows (or rows being tagged as test data) are exempt so QA cleanup can run.
  IF COALESCE(OLD.is_test_record, false) OR (TG_OP <> 'DELETE' AND COALESCE(NEW.is_test_record, false)) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF OLD.status IN ('completed','failed','cancelled') THEN
    RAISE EXCEPTION 'score_runs row % is immutable (status=%)', OLD.id, OLD.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

UPDATE public.score_runs sr
SET    is_test_record = true,
       test_run_id    = cm.test_run_id,
       created_by_audit = true
FROM   public.candidate_matches cm
WHERE  sr.candidate_match_id = cm.id
  AND  cm.test_run_id IS NOT NULL
  AND  sr.test_run_id IS NULL;

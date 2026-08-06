ALTER TABLE public.score_runs
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by_run_id uuid REFERENCES public.score_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded_reason text;

-- Finished runs stay immutable, with ONE exception: the supersede bookkeeping
-- fields may be filled in once. Nothing about the score itself can change.
CREATE OR REPLACE FUNCTION public.tg_score_runs_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(OLD.is_test_record, false) OR (TG_OP <> 'DELETE' AND COALESCE(NEW.is_test_record, false)) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.superseded_at IS NULL
     AND NEW.superseded_at IS NOT NULL
     AND NEW.id IS NOT DISTINCT FROM OLD.id
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.score IS NOT DISTINCT FROM OLD.score
     AND NEW.final_score IS NOT DISTINCT FROM OLD.final_score
     AND NEW.raw_score IS NOT DISTINCT FROM OLD.raw_score
     AND NEW.confidence IS NOT DISTINCT FROM OLD.confidence
     AND NEW.evidence_confidence IS NOT DISTINCT FROM OLD.evidence_confidence
     AND NEW.input_hash IS NOT DISTINCT FROM OLD.input_hash
     AND NEW.rubric_version_id IS NOT DISTINCT FROM OLD.rubric_version_id
     AND NEW.result IS NOT DISTINCT FROM OLD.result
     AND NEW.evidence IS NOT DISTINCT FROM OLD.evidence
     AND NEW.completed_at IS NOT DISTINCT FROM OLD.completed_at THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('completed','failed','cancelled') THEN
    RAISE EXCEPTION 'score_runs row % is immutable (status=%)', OLD.id, OLD.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $function$;

WITH ranked AS (
  SELECT id,
         first_value(id) OVER (
           PARTITION BY candidate_match_id, input_hash
           ORDER BY completed_at ASC NULLS LAST, started_at ASC NULLS LAST, id ASC
         ) AS keeper_id
  FROM public.score_runs
  WHERE status = 'completed' AND superseded_at IS NULL
)
UPDATE public.score_runs sr
SET superseded_at = now(),
    superseded_by_run_id = r.keeper_id,
    superseded_reason = 'duplicate_input_hash'
FROM ranked r
WHERE sr.id = r.id AND r.keeper_id <> r.id;

CREATE UNIQUE INDEX IF NOT EXISTS score_runs_active_input_key
  ON public.score_runs (candidate_match_id, input_hash, rubric_version_id)
  WHERE status = 'completed' AND superseded_at IS NULL;

-- 1) Allow the accurate method label.
ALTER TABLE public.score_runs
  DROP CONSTRAINT IF EXISTS score_runs_evaluation_method_check;

ALTER TABLE public.score_runs
  ADD CONSTRAINT score_runs_evaluation_method_check
  CHECK (evaluation_method IS NULL OR evaluation_method IN (
    'keyword', 'semantic', 'hybrid', 'deterministic_keyword'
  ));

COMMENT ON COLUMN public.score_runs.evaluation_method IS
  'How the score was reached. deterministic_keyword = rule-based keyword + screening matching, no model call (current engine). keyword/semantic/hybrid are legacy labels; hybrid rows before 2026-08 were mislabelled and corrected in-place.';

-- 2) Correct the mislabelled historical rows. Runs are immutable by trigger;
--    this is a one-off provenance correction, so the guard is lifted only for
--    the duration of this statement and restored immediately.
ALTER TABLE public.score_runs DISABLE TRIGGER score_runs_immutable;

UPDATE public.score_runs
   SET evaluation_method = 'deterministic_keyword'
 WHERE evaluation_method = 'hybrid';

ALTER TABLE public.score_runs ENABLE TRIGGER score_runs_immutable;

-- Rollback note: to revert, set evaluation_method back to 'hybrid' for rows
-- with completed_at < now() using the same trigger-disable pattern, and restore
-- the previous CHECK constraint without 'deterministic_keyword'.

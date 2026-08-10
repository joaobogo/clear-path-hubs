-- Truthful evaluation-method vocabulary for NEW score runs.
--
-- The stored check allowed the retired words ("hybrid", "keyword",
-- "deterministic_keyword") and rejected the two values the engine actually
-- writes ("deterministic", "human_adjusted") — so every new run and every
-- human-adjusted run would have been refused by the database.
--
-- Completed runs are immutable by design, so historical rows are NOT
-- relabelled. The new constraints are added NOT VALID: enforced on every
-- insert and update from now on, silent about pre-contract history, which the
-- application already normalises on read.

ALTER TABLE public.score_runs
  DROP CONSTRAINT IF EXISTS score_runs_evaluation_method_check;

ALTER TABLE public.score_runs
  ALTER COLUMN evaluation_method SET DEFAULT 'legacy';

ALTER TABLE public.score_runs
  ADD CONSTRAINT score_runs_evaluation_method_check
  CHECK (
    evaluation_method IN ('deterministic', 'semantic', 'human_adjusted', 'legacy')
  ) NOT VALID;

ALTER TABLE public.score_runs
  DROP CONSTRAINT IF EXISTS score_runs_cap_provenance_ok;

ALTER TABLE public.score_runs
  ADD CONSTRAINT score_runs_cap_provenance_ok
  CHECK (
    (applied_cap IS NULL OR cap_reason IS NOT NULL)
    AND (final_score >= raw_score OR applied_cap IS NOT NULL)
  ) NOT VALID;

COMMENT ON COLUMN public.score_runs.evaluation_method IS
  'How the run was produced: deterministic | semantic | human_adjusted | legacy. Never "hybrid" — that word never recorded which path ran. Pre-contract rows may still hold older strings and are normalised on read.';
COMMENT ON COLUMN public.score_runs.applied_cap IS
  'The lowest ceiling in force on the 0-100 scale, or NULL when the score was never clamped. Never a mirror of raw_score.';
COMMENT ON COLUMN public.score_runs.rubric_version_id IS
  'The immutable rubric version that governed this run. Required: a score with no criteria list behind it is unauditable.';
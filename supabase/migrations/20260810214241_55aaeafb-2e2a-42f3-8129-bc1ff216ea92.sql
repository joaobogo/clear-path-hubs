ALTER TABLE public.score_runs DROP CONSTRAINT IF EXISTS score_runs_evaluation_method_check;
ALTER TABLE public.score_runs ADD CONSTRAINT score_runs_evaluation_method_check CHECK (
  evaluation_method IN ('deterministic','semantic','human_adjusted','legacy','deterministic_keyword')
) NOT VALID;
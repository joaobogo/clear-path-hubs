ALTER TABLE public.score_runs DROP CONSTRAINT IF EXISTS score_runs_cap_provenance_ok;
ALTER TABLE public.score_runs ADD CONSTRAINT score_runs_cap_provenance_ok CHECK (
  applied_cap IS NULL
  OR cap_reason IS NOT NULL
  OR evaluation_method NOT IN ('deterministic','semantic','human_adjusted')
) NOT VALID;
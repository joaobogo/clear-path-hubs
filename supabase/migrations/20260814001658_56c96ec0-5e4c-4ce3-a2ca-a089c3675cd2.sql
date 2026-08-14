-- 1. Repair: supersede all but the newest completed run per (match, submission).
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY candidate_match_id, candidate_submission_id
           ORDER BY completed_at DESC NULLS LAST, started_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM public.score_runs
  WHERE status = 'completed' AND superseded_at IS NULL
)
UPDATE public.score_runs s
SET superseded_at = now(),
    superseded_reason = 'duplicate_current_repair'
FROM ranked r
WHERE s.id = r.id AND r.rn > 1;

-- 2. Prevent recurrence: only one live completed run per submission.
CREATE UNIQUE INDEX IF NOT EXISTS score_runs_one_current_per_submission
  ON public.score_runs (candidate_match_id, candidate_submission_id)
  WHERE status = 'completed' AND superseded_at IS NULL;

ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS position_id uuid REFERENCES public.positions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS candidate_submission_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS interview_type text,
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS meeting_url text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS proposed_times jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS feedback text,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

UPDATE public.interviews i
SET position_id = cm.position_id,
    candidate_submission_id = cm.application_id
FROM public.candidate_matches cm
WHERE i.candidate_match_id = cm.id
  AND (i.position_id IS NULL OR i.candidate_submission_id IS NULL);

ALTER TABLE public.interviews
  ALTER COLUMN position_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS interviews_position_ix ON public.interviews(position_id);
CREATE INDEX IF NOT EXISTS interviews_submission_ix ON public.interviews(candidate_submission_id);

-- Prevent duplicate active interview per candidate match
CREATE UNIQUE INDEX IF NOT EXISTS interviews_active_per_match_uq
  ON public.interviews(candidate_match_id)
  WHERE status IN ('requested','scheduling','scheduled');

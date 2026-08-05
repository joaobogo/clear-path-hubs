ALTER TABLE public.interview_scorecards
  ADD COLUMN IF NOT EXISTS next_step text
    CHECK (next_step IS NULL OR next_step IN ('another_interview','make_offer','stop_here'));

COMMENT ON COLUMN public.interview_scorecards.next_step IS 'Chosen next step from the two-minute interview feedback form.';
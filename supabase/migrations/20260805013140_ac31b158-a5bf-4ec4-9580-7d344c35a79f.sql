ALTER TABLE public.intake_submissions
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS intake_submissions_open_created_idx
  ON public.intake_submissions (created_at DESC)
  WHERE position_id IS NULL;
CREATE TABLE IF NOT EXISTS public.intake_drafts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_drafts TO authenticated;
GRANT ALL ON public.intake_drafts TO service_role;

ALTER TABLE public.intake_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "intake_drafts_own" ON public.intake_drafts;
CREATE POLICY "intake_drafts_own" ON public.intake_drafts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
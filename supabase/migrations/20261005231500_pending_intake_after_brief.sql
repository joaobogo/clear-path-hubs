-- Pending employer intake captured before account creation.
-- The public form can now accept the full role brief first, then ask the
-- prospect to secure the workspace with the same work email. The payload is
-- temporary and is cleared as soon as the signed-in user finalizes the intake.

CREATE TABLE IF NOT EXISTS public.pending_intake_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  email text NOT NULL,
  company_name text NOT NULL,
  role_title text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending_account'
    CHECK (status IN ('pending_account','finalized','expired')),
  finalized_intake_id uuid REFERENCES public.intake_submissions(id) ON DELETE SET NULL,
  finalized_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pending_intake_submissions_email_idx
  ON public.pending_intake_submissions (lower(email), created_at DESC);

CREATE INDEX IF NOT EXISTS pending_intake_submissions_expires_idx
  ON public.pending_intake_submissions (expires_at);

GRANT ALL ON public.pending_intake_submissions TO service_role;

ALTER TABLE public.pending_intake_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pending_intake_staff_read" ON public.pending_intake_submissions;
CREATE POLICY "pending_intake_staff_read"
  ON public.pending_intake_submissions
  FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));

CREATE TRIGGER pending_intake_submissions_touch
  BEFORE UPDATE ON public.pending_intake_submissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

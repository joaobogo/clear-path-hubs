ALTER TABLE public.intake_drafts
  ADD COLUMN IF NOT EXISTS last_step integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days');

CREATE TABLE IF NOT EXISTS public.anonymous_intake_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_step integer NOT NULL DEFAULT 0,
  resume_email text,
  resume_email_sent_at timestamptz,
  submitted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.anonymous_intake_drafts TO service_role;

ALTER TABLE public.anonymous_intake_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anonymous_intake_drafts_staff_read"
  ON public.anonymous_intake_drafts FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS anonymous_intake_drafts_expires_idx
  ON public.anonymous_intake_drafts (expires_at);

CREATE TRIGGER anonymous_intake_drafts_touch
  BEFORE UPDATE ON public.anonymous_intake_drafts
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE OR REPLACE FUNCTION public.purge_expired_intake_drafts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  removed integer := 0;
  n integer := 0;
BEGIN
  DELETE FROM public.anonymous_intake_drafts WHERE expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  removed := removed + n;
  DELETE FROM public.intake_drafts WHERE expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  removed := removed + n;
  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_intake_drafts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_intake_drafts() TO service_role;
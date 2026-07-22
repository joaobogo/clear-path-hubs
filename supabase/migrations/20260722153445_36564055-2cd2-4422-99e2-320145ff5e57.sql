
CREATE TABLE public.intake_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  primary_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  primary_email text NOT NULL,
  company_name text NOT NULL,
  role_title text NOT NULL,
  source text NOT NULL DEFAULT 'public_form',
  status text NOT NULL DEFAULT 'submitted',
  workspace_status text NOT NULL DEFAULT 'ready',
  requisition_pending boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  trace_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX intake_submissions_org_idx ON public.intake_submissions(organization_id, created_at DESC);
CREATE INDEX intake_submissions_status_idx ON public.intake_submissions(status, created_at DESC);

GRANT ALL ON public.intake_submissions TO service_role;
GRANT SELECT ON public.intake_submissions TO authenticated;

ALTER TABLE public.intake_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intake_staff_read" ON public.intake_submissions FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));

CREATE POLICY "intake_org_read" ON public.intake_submissions FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_viewer(auth.uid(), organization_id));

CREATE TRIGGER intake_submissions_touch BEFORE UPDATE ON public.intake_submissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

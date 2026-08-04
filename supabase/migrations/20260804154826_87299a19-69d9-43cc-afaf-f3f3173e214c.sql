CREATE TABLE public.lead_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  lead_type text NOT NULL,
  source text NOT NULL,
  source_page text,
  priority text NOT NULL DEFAULT 'standard',
  owner_email text,
  full_name text,
  email text,
  company text,
  phone text,
  message text,
  record_table text,
  record_id text,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  teams_status text NOT NULL DEFAULT 'pending',
  teams_detail text,
  teams_at timestamptz,
  email_status text NOT NULL DEFAULT 'pending',
  email_detail text,
  email_at timestamptz,
  email_recipients text[] NOT NULL DEFAULT '{}',
  crm_status text NOT NULL DEFAULT 'not_applicable',
  crm_detail text,
  attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lead_notifications_created_idx ON public.lead_notifications (created_at DESC);
CREATE INDEX lead_notifications_status_idx ON public.lead_notifications (teams_status, email_status);

GRANT SELECT ON public.lead_notifications TO authenticated;
GRANT ALL ON public.lead_notifications TO service_role;

ALTER TABLE public.lead_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform staff can read lead notifications"
ON public.lead_notifications FOR SELECT TO authenticated
USING (public.is_platform_staff(auth.uid()));

CREATE TRIGGER lead_notifications_touch_updated_at
BEFORE UPDATE ON public.lead_notifications
FOR EACH ROW EXECUTE FUNCTION public.payments_touch_updated_at();
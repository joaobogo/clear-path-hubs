CREATE TABLE IF NOT EXISTS public.booking_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'intake_submitted'
    CHECK (status IN ('intake_submitted','scheduled','rescheduled','cancelled','completed','abandoned')),
  meeting_type text NOT NULL DEFAULT 'discovery',
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  job_title text,
  company_name text,
  company_website text,
  company_domain text,
  company_size text,
  open_roles text,
  hiring_volume text,
  roles_hiring text,
  hiring_challenge text,
  current_process text,
  hiring_timeline text,
  heard_about text,
  additional_context text,
  qualification_score integer,
  attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  attio jsonb NOT NULL DEFAULT '{}'::jsonb,
  attio_synced_at timestamptz,
  attio_error text,
  calendly_event_uri text UNIQUE,
  calendly_invitee_uri text UNIQUE,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  timezone text,
  host_name text,
  host_email text,
  join_url text,
  reschedule_url text,
  cancel_url text,
  scheduled_at timestamptz,
  cancelled_at timestamptz
);

CREATE INDEX IF NOT EXISTS booking_sessions_email_idx ON public.booking_sessions (lower(email));
CREATE INDEX IF NOT EXISTS booking_sessions_status_idx ON public.booking_sessions (status, created_at DESC);

GRANT SELECT ON public.booking_sessions TO authenticated;
GRANT ALL ON public.booking_sessions TO service_role;
ALTER TABLE public.booking_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_sessions_select_staff" ON public.booking_sessions
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));

CREATE TRIGGER booking_sessions_updated_at
  BEFORE UPDATE ON public.booking_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.calendly_webhook_events (
  id text NOT NULL PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  booking_session_id uuid REFERENCES public.booking_sessions(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT ON public.calendly_webhook_events TO authenticated;
GRANT ALL ON public.calendly_webhook_events TO service_role;
ALTER TABLE public.calendly_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendly_webhook_events_select_staff" ON public.calendly_webhook_events
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));

-- Enums
CREATE TYPE public.event_type AS ENUM (
  'intake_submitted','clarification_requested','position_approved','position_activated',
  'application_received','candidate_processing_completed','candidate_ready_for_admin_review',
  'candidate_published','client_shortlisted','interview_requested','interview_scheduled',
  'client_feedback_submitted','candidate_hired','position_closed','message_sent'
);

CREATE TYPE public.notification_audience AS ENUM ('admin','client','candidate');
CREATE TYPE public.delivery_channel AS ENUM ('in_app','email','sms');
CREATE TYPE public.delivery_status AS ENUM (
  'created','queued','provider_accepted','delivered','failed','bounced','suppressed'
);

-- Canonical event log
CREATE TABLE public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type public.event_type NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  candidate_match_id uuid REFERENCES public.candidate_matches(id) ON DELETE SET NULL,
  candidate_profile_id uuid REFERENCES public.candidate_profiles(id) ON DELETE SET NULL,
  actor_user_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_org ON public.notification_events(organization_id, created_at DESC);
CREATE INDEX idx_events_type ON public.notification_events(event_type, created_at DESC);

GRANT SELECT ON public.notification_events TO authenticated;
GRANT ALL ON public.notification_events TO service_role;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY events_staff_read ON public.notification_events
  FOR SELECT USING (public.is_platform_staff(auth.uid()));
CREATE POLICY events_org_read ON public.notification_events
  FOR SELECT USING (organization_id IS NOT NULL AND public.is_org_viewer(auth.uid(), organization_id));

-- Per-recipient in-app notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.notification_events(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL,
  audience public.notification_audience NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type public.event_type NOT NULL,
  title text NOT NULL,
  body text,
  link_path text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, recipient_user_id)
);
CREATE INDEX idx_notif_recipient ON public.notifications(recipient_user_id, read_at, created_at DESC);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_recipient_read ON public.notifications
  FOR SELECT USING (recipient_user_id = auth.uid());
CREATE POLICY notif_recipient_update ON public.notifications
  FOR UPDATE USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());
CREATE POLICY notif_staff_read ON public.notifications
  FOR SELECT USING (public.is_platform_staff(auth.uid()));

-- Per-channel delivery tracking
CREATE TABLE public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  channel public.delivery_channel NOT NULL,
  status public.delivery_status NOT NULL DEFAULT 'created',
  provider_message_id text,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, channel)
);
CREATE INDEX idx_deliv_status ON public.notification_deliveries(status, updated_at DESC);

GRANT SELECT ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY deliv_staff_read ON public.notification_deliveries
  FOR SELECT USING (public.is_platform_staff(auth.uid()));

CREATE TRIGGER trg_deliv_updated_at
  BEFORE UPDATE ON public.notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

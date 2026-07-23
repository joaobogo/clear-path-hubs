
CREATE TABLE public.client_notification_preferences (
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  candidate_delivered boolean NOT NULL DEFAULT true,
  interview_request boolean NOT NULL DEFAULT true,
  new_message boolean NOT NULL DEFAULT true,
  offer_update boolean NOT NULL DEFAULT true,
  hire_update boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  digest text NOT NULL DEFAULT 'immediate' CHECK (digest IN ('immediate','daily','off')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, organization_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_notification_preferences TO authenticated;
GRANT ALL ON public.client_notification_preferences TO service_role;

ALTER TABLE public.client_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cnp_member_select"
  ON public.client_notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "cnp_member_upsert"
  ON public.client_notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "cnp_member_update"
  ON public.client_notification_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER _cnp_touch BEFORE UPDATE ON public.client_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

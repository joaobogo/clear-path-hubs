ALTER TYPE public.delivery_channel ADD VALUE IF NOT EXISTS 'teams';

CREATE TABLE IF NOT EXISTS public.teams_channel_links (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id text NOT NULL,
  channel_id text NOT NULL,
  channel_label text,
  enabled boolean NOT NULL DEFAULT true,
  events text[] NOT NULL DEFAULT ARRAY['candidate_published','interview_scheduled','client_hold','client_declined','position_activated','message_sent']::text[],
  connected_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams_channel_links TO authenticated;
GRANT ALL ON public.teams_channel_links TO service_role;
ALTER TABLE public.teams_channel_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teams_links_member_read" ON public.teams_channel_links
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "teams_links_admin_write" ON public.teams_channel_links
  FOR ALL TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()) OR public.is_platform_staff(auth.uid()));

CREATE TRIGGER teams_channel_links_updated_at
  BEFORE UPDATE ON public.teams_channel_links
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.teams_action_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  candidate_match_id uuid NOT NULL REFERENCES public.candidate_matches(id) ON DELETE CASCADE,
  action text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.teams_action_links TO service_role;
ALTER TABLE public.teams_action_links ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS teams_action_links_match_idx
  ON public.teams_action_links (candidate_match_id);

CREATE TABLE IF NOT EXISTS public.teams_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  event_type text,
  status text NOT NULL,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.teams_delivery_log TO authenticated;
GRANT ALL ON public.teams_delivery_log TO service_role;
ALTER TABLE public.teams_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teams_delivery_staff_read" ON public.teams_delivery_log
  FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS teams_delivery_log_created_idx
  ON public.teams_delivery_log (created_at DESC);
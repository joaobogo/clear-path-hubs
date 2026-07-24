
-- Outreach engine ---------------------------------------------------------
DO $$ BEGIN CREATE TYPE public.outreach_channel AS ENUM ('email','linkedin','phone','sms','referral','event','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.outreach_campaign_status AS ENUM ('draft','active','paused','completed','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.outreach_touch_state AS ENUM ('queued','sent','delivered','bounced','opened','replied','opted_out','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.outreach_reply_category AS ENUM ('interested','not_interested','future','referral','out_of_office','unsubscribe','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.outreach_engagement_state AS ENUM ('cold','contacted','engaged','warm','hot','opted_out'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.outreach_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  name text NOT NULL,
  channel public.outreach_channel NOT NULL,
  status public.outreach_campaign_status NOT NULL DEFAULT 'draft',
  owner_user_id uuid,
  target_count integer,
  notes text,
  started_at timestamptz,
  ended_at timestamptz,
  is_test_record boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outreach_campaigns_org_ix ON public.outreach_campaigns(organization_id, status);
CREATE INDEX IF NOT EXISTS outreach_campaigns_position_ix ON public.outreach_campaigns(position_id);

CREATE TABLE IF NOT EXISTS public.outreach_touches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.outreach_campaigns(id) ON DELETE CASCADE,
  candidate_profile_id uuid REFERENCES public.candidate_profiles(id) ON DELETE SET NULL,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  channel public.outreach_channel NOT NULL,
  state public.outreach_touch_state NOT NULL DEFAULT 'queued',
  reply_category public.outreach_reply_category,
  engagement_state public.outreach_engagement_state,
  sent_at timestamptz,
  delivered_at timestamptz,
  replied_at timestamptz,
  error text,
  is_test_record boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outreach_touches_campaign_ix ON public.outreach_touches(campaign_id, state);
CREATE INDEX IF NOT EXISTS outreach_touches_org_ix ON public.outreach_touches(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS outreach_touches_candidate_ix ON public.outreach_touches(candidate_profile_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_touches   TO authenticated;
GRANT ALL ON public.outreach_campaigns TO service_role;
GRANT ALL ON public.outreach_touches   TO service_role;

ALTER TABLE public.outreach_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_touches   ENABLE ROW LEVEL SECURITY;

-- Campaigns
DROP POLICY IF EXISTS outreach_campaigns_org_read ON public.outreach_campaigns;
CREATE POLICY outreach_campaigns_org_read ON public.outreach_campaigns
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

DROP POLICY IF EXISTS outreach_campaigns_org_write ON public.outreach_campaigns;
CREATE POLICY outreach_campaigns_org_write ON public.outreach_campaigns
  FOR ALL TO authenticated
  USING (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

-- Touches
DROP POLICY IF EXISTS outreach_touches_org_read ON public.outreach_touches;
CREATE POLICY outreach_touches_org_read ON public.outreach_touches
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

DROP POLICY IF EXISTS outreach_touches_org_write ON public.outreach_touches;
CREATE POLICY outreach_touches_org_write ON public.outreach_touches
  FOR ALL TO authenticated
  USING (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE TRIGGER outreach_campaigns_touch_updated_at
  BEFORE UPDATE ON public.outreach_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER outreach_touches_touch_updated_at
  BEFORE UPDATE ON public.outreach_touches
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Per-channel tiles (client-safe rollup)
CREATE OR REPLACE VIEW public.v_outreach_channel_tiles
WITH (security_invoker=on) AS
SELECT
  c.organization_id,
  c.channel,
  count(DISTINCT c.id) FILTER (WHERE c.status = 'active') AS active_campaigns,
  count(DISTINCT c.id) AS total_campaigns,
  count(t.id) FILTER (WHERE t.state IN ('sent','delivered','opened','replied','opted_out','bounced')) AS touches_sent,
  count(t.id) FILTER (WHERE t.state = 'delivered') AS delivered,
  count(t.id) FILTER (WHERE t.state = 'bounced')   AS bounced,
  count(t.id) FILTER (WHERE t.state = 'opened')    AS opened,
  count(t.id) FILTER (WHERE t.state = 'replied')   AS replied,
  count(t.id) FILTER (WHERE t.state = 'opted_out') AS opted_out,
  count(t.id) FILTER (WHERE t.state = 'failed')    AS failed,
  count(t.id) FILTER (WHERE t.reply_category = 'interested')     AS reply_interested,
  count(t.id) FILTER (WHERE t.reply_category = 'not_interested') AS reply_not_interested,
  count(t.id) FILTER (WHERE t.reply_category = 'future')         AS reply_future,
  count(t.id) FILTER (WHERE t.reply_category = 'referral')       AS reply_referral,
  count(t.id) FILTER (WHERE t.reply_category = 'out_of_office')  AS reply_ooo,
  count(t.id) FILTER (WHERE t.reply_category = 'unsubscribe')    AS reply_unsub,
  count(DISTINCT t.candidate_profile_id) FILTER (WHERE t.engagement_state IN ('engaged','warm','hot')) AS engaged_candidates
FROM public.outreach_campaigns c
LEFT JOIN public.outreach_touches t
  ON t.campaign_id = c.id AND COALESCE(t.is_test_record, false) = false
WHERE COALESCE(c.is_test_record, false) = false
GROUP BY c.organization_id, c.channel;

-- Per-campaign rollup (admin ops)
CREATE OR REPLACE VIEW public.v_outreach_campaigns
WITH (security_invoker=on) AS
SELECT
  c.id,
  c.organization_id,
  c.position_id,
  c.name,
  c.channel,
  c.status,
  c.owner_user_id,
  c.target_count,
  c.started_at,
  c.ended_at,
  c.created_at,
  count(t.id) AS touches_total,
  count(t.id) FILTER (WHERE t.state IN ('sent','delivered','opened','replied','opted_out','bounced')) AS touches_sent,
  count(t.id) FILTER (WHERE t.state = 'delivered') AS delivered,
  count(t.id) FILTER (WHERE t.state = 'bounced')   AS bounced,
  count(t.id) FILTER (WHERE t.state = 'replied')   AS replied,
  count(t.id) FILTER (WHERE t.state = 'opted_out') AS opted_out,
  count(t.id) FILTER (WHERE t.state = 'failed')    AS failed
FROM public.outreach_campaigns c
LEFT JOIN public.outreach_touches t
  ON t.campaign_id = c.id AND COALESCE(t.is_test_record, false) = false
WHERE COALESCE(c.is_test_record, false) = false
GROUP BY c.id;

GRANT SELECT ON public.v_outreach_channel_tiles TO authenticated;
GRANT SELECT ON public.v_outreach_campaigns TO authenticated;
GRANT ALL ON public.v_outreach_channel_tiles TO service_role;
GRANT ALL ON public.v_outreach_campaigns TO service_role;

-- =========================================================
-- Part 2: recruiting agents + multichannel outreach spine
-- =========================================================

-- ---------- Agent settings (one row per org per agent) ----------
CREATE TABLE public.agent_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  paused_at timestamptz,
  paused_by uuid,
  last_action_at timestamptz,
  last_action_summary text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, agent_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_settings TO authenticated;
GRANT ALL ON public.agent_settings TO service_role;

ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_settings_org_read" ON public.agent_settings
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "agent_settings_admin_write" ON public.agent_settings
  FOR ALL TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE TRIGGER agent_settings_touch_updated_at
  BEFORE UPDATE ON public.agent_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ---------- Agent activity feed ----------
CREATE TABLE public.agent_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_key text NOT NULL,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  candidate_match_id uuid REFERENCES public.candidate_matches(id) ON DELETE SET NULL,
  outcome text NOT NULL CHECK (outcome IN ('acted', 'blocked', 'skipped', 'failed')),
  sentence text NOT NULL,
  reason text,
  link_path text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX agent_activity_org_recent_ix
  ON public.agent_activity (organization_id, occurred_at DESC);
CREATE INDEX agent_activity_agent_ix
  ON public.agent_activity (organization_id, agent_key, occurred_at DESC);

GRANT SELECT ON public.agent_activity TO authenticated;
GRANT ALL ON public.agent_activity TO service_role;

ALTER TABLE public.agent_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_activity_org_read" ON public.agent_activity
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "agent_activity_staff_write" ON public.agent_activity
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_staff(auth.uid()));

-- ---------- Channel sequencing rules ----------
CREATE TABLE public.outreach_channel_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel public.outreach_channel NOT NULL,
  max_contacts_per_person integer NOT NULL DEFAULT 1,
  window_hours integer NOT NULL DEFAULT 168,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, channel)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_channel_rules TO authenticated;
GRANT ALL ON public.outreach_channel_rules TO service_role;

ALTER TABLE public.outreach_channel_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outreach_channel_rules_org_read" ON public.outreach_channel_rules
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "outreach_channel_rules_admin_write" ON public.outreach_channel_rules
  FOR ALL TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE TRIGGER outreach_channel_rules_touch_updated_at
  BEFORE UPDATE ON public.outreach_channel_rules
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ---------- Opt-outs ----------
CREATE TABLE public.outreach_opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  candidate_profile_id uuid REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  email public.citext,
  channel public.outreach_channel,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (candidate_profile_id IS NOT NULL OR email IS NOT NULL)
);

CREATE INDEX outreach_opt_outs_cp_ix ON public.outreach_opt_outs (candidate_profile_id);
CREATE INDEX outreach_opt_outs_email_ix ON public.outreach_opt_outs (email);

GRANT SELECT, INSERT ON public.outreach_opt_outs TO authenticated;
GRANT ALL ON public.outreach_opt_outs TO service_role;

ALTER TABLE public.outreach_opt_outs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outreach_opt_outs_org_read" ON public.outreach_opt_outs
  FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR public.is_org_member(auth.uid(), organization_id)
    OR public.is_platform_staff(auth.uid())
  );

CREATE POLICY "outreach_opt_outs_write" ON public.outreach_opt_outs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_staff(auth.uid())
    OR (organization_id IS NOT NULL AND public.is_org_editor(auth.uid(), organization_id))
  );

-- ---------- Campaign + touch columns for the multichannel spine ----------
ALTER TABLE public.outreach_campaigns
  ADD COLUMN IF NOT EXISTS channels public.outreach_channel[] NOT NULL DEFAULT '{}';

ALTER TABLE public.outreach_touches
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'outbound',
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS reply_body text,
  ADD COLUMN IF NOT EXISTS sequence_step integer,
  ADD COLUMN IF NOT EXISTS blocked_reason text;

-- Backfill campaign channel arrays from the single-channel column.
UPDATE public.outreach_campaigns
SET channels = ARRAY[channel]
WHERE cardinality(channels) = 0;

-- ---------- The contact guard ----------
CREATE OR REPLACE FUNCTION public.outreach_contact_allowed(
  _org uuid,
  _candidate_profile_id uuid,
  _channel public.outreach_channel
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rule public.outreach_channel_rules%ROWTYPE;
  _max int := 1;
  _window int := 168;
  _recent int;
BEGIN
  IF _candidate_profile_id IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'reason', null);
  END IF;

  -- 1. Opted out, on this channel or across all channels.
  IF EXISTS (
    SELECT 1 FROM public.outreach_opt_outs o
    WHERE o.candidate_profile_id = _candidate_profile_id
      AND (o.channel IS NULL OR o.channel = _channel)
      AND (o.organization_id IS NULL OR o.organization_id = _org)
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'opted_out');
  END IF;

  -- 2. Already replied to us on any channel: stop the sequence.
  IF EXISTS (
    SELECT 1 FROM public.outreach_touches t
    WHERE t.candidate_profile_id = _candidate_profile_id
      AND t.organization_id = _org
      AND t.state = 'replied'
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'already_replied');
  END IF;

  -- 3. Hard stop across all channels once the person is in process.
  IF EXISTS (
    SELECT 1 FROM public.candidate_matches m
    WHERE m.candidate_profile_id = _candidate_profile_id
      AND m.organization_id = _org
      AND m.stage::text IN ('shortlisted', 'interviewing', 'offer', 'hired')
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'in_process');
  END IF;

  -- 4. Frequency cap for this channel.
  SELECT * INTO _rule
  FROM public.outreach_channel_rules r
  WHERE r.organization_id = _org AND r.channel = _channel;

  IF FOUND THEN
    IF NOT _rule.enabled THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'channel_disabled');
    END IF;
    _max := _rule.max_contacts_per_person;
    _window := _rule.window_hours;
  END IF;

  SELECT count(*) INTO _recent
  FROM public.outreach_touches t
  WHERE t.candidate_profile_id = _candidate_profile_id
    AND t.organization_id = _org
    AND t.channel = _channel
    AND t.direction = 'outbound'
    AND t.state::text IN ('sent', 'delivered', 'opened', 'replied')
    AND coalesce(t.sent_at, t.created_at) > now() - make_interval(hours => _window);

  IF _recent >= _max THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'frequency_cap');
  END IF;

  RETURN jsonb_build_object('allowed', true, 'reason', null);
END;
$$;

REVOKE ALL ON FUNCTION public.outreach_contact_allowed(uuid, uuid, public.outreach_channel) FROM public;
GRANT EXECUTE ON FUNCTION public.outreach_contact_allowed(uuid, uuid, public.outreach_channel) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tg_outreach_touch_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _verdict jsonb;
BEGIN
  IF NEW.direction <> 'outbound' THEN
    RETURN NEW;
  END IF;
  IF NEW.state::text NOT IN ('queued', 'sent') THEN
    RETURN NEW;
  END IF;

  _verdict := public.outreach_contact_allowed(
    NEW.organization_id, NEW.candidate_profile_id, NEW.channel
  );

  IF (_verdict->>'allowed')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'outreach_blocked:%', _verdict->>'reason'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_outreach_touch_guard
  BEFORE INSERT ON public.outreach_touches
  FOR EACH ROW EXECUTE FUNCTION public.tg_outreach_touch_guard();

-- ---------- Honest per-role outreach reporting (no opens) ----------
CREATE OR REPLACE VIEW public.outreach_role_report
WITH (security_invoker = true)
AS
WITH touches AS (
  SELECT
    c.position_id,
    t.organization_id,
    t.candidate_profile_id,
    t.state,
    t.reply_category,
    t.sent_at,
    t.replied_at
  FROM public.outreach_touches t
  JOIN public.outreach_campaigns c ON c.id = t.campaign_id
  WHERE t.direction = 'outbound'
    AND t.is_test_record = false
    AND c.position_id IS NOT NULL
)
SELECT
  x.position_id,
  x.organization_id,
  count(DISTINCT x.candidate_profile_id)
    FILTER (WHERE x.state::text IN ('sent', 'delivered', 'opened', 'replied')) AS people_contacted,
  count(DISTINCT x.candidate_profile_id)
    FILTER (WHERE x.state = 'replied') AS people_replied,
  count(DISTINCT x.candidate_profile_id)
    FILTER (WHERE x.reply_category = 'interested') AS replies_interested,
  count(DISTINCT x.candidate_profile_id)
    FILTER (WHERE x.reply_category = 'not_interested') AS replies_not_interested,
  count(DISTINCT x.candidate_profile_id)
    FILTER (WHERE x.reply_category = 'future') AS replies_future,
  count(DISTINCT x.candidate_profile_id)
    FILTER (WHERE x.reply_category = 'referral') AS replies_referral,
  count(DISTINCT x.candidate_profile_id)
    FILTER (WHERE x.reply_category = 'unsubscribe') AS replies_unsubscribe,
  count(DISTINCT x.candidate_profile_id)
    FILTER (WHERE x.reply_category::text IN ('out_of_office', 'other')) AS replies_other,
  (
    SELECT count(DISTINCT m.candidate_profile_id)
    FROM public.candidate_matches m
    WHERE m.position_id = x.position_id
      AND m.stage::text IN ('shortlisted', 'interviewing', 'offer', 'hired')
      AND m.candidate_profile_id IN (
        SELECT y.candidate_profile_id FROM touches y
        WHERE y.position_id = x.position_id
          AND y.state::text IN ('sent', 'delivered', 'opened', 'replied')
      )
  ) AS became_shortlisted,
  (
    SELECT count(DISTINCT m.candidate_profile_id)
    FROM public.candidate_matches m
    WHERE m.position_id = x.position_id
      AND m.stage::text = 'hired'
      AND m.candidate_profile_id IN (
        SELECT y.candidate_profile_id FROM touches y
        WHERE y.position_id = x.position_id
          AND y.state::text IN ('sent', 'delivered', 'opened', 'replied')
      )
  ) AS became_hired,
  min(x.sent_at) AS first_touch_at,
  max(coalesce(x.replied_at, x.sent_at)) AS last_activity_at
FROM touches x
GROUP BY x.position_id, x.organization_id;

GRANT SELECT ON public.outreach_role_report TO authenticated;
GRANT SELECT ON public.outreach_role_report TO service_role;
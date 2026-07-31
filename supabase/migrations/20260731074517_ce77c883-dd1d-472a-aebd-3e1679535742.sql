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

  IF EXISTS (
    SELECT 1 FROM public.outreach_opt_outs o
    WHERE o.candidate_profile_id = _candidate_profile_id
      AND (o.channel IS NULL OR o.channel = _channel)
      AND (o.organization_id IS NULL OR o.organization_id = _org)
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'opted_out');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.outreach_touches t
    WHERE t.candidate_profile_id = _candidate_profile_id
      AND t.organization_id = _org
      AND t.state = 'replied'
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'already_replied');
  END IF;

  -- Hard stop across every channel once the person is in process for any role.
  IF EXISTS (
    SELECT 1 FROM public.candidate_matches m
    WHERE m.candidate_profile_id = _candidate_profile_id
      AND m.organization_id = _org
      AND m.stage::text IN ('delivered', 'shortlisted', 'interview_process', 'offer', 'hired')
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'in_process');
  END IF;

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
      AND m.stage::text IN ('shortlisted', 'interview_process', 'offer', 'hired')
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
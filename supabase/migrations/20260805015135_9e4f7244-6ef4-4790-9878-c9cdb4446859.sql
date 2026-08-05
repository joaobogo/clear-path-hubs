CREATE OR REPLACE FUNCTION public.outreach_contact_allowed(_org uuid, _candidate_profile_id uuid, _channel outreach_channel)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _rule public.outreach_channel_rules%ROWTYPE;
  _max int := 1;
  _window int := 168;
  _recent int;
BEGIN
  SELECT * INTO _rule
  FROM public.outreach_channel_rules r
  WHERE r.organization_id = _org AND r.channel = _channel;

  IF FOUND THEN
    -- A paused channel blocks every send on it, candidate-linked or not.
    IF NOT _rule.enabled THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'channel_disabled');
    END IF;
    _max := _rule.max_contacts_per_person;
    _window := _rule.window_hours;
  END IF;

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

  IF EXISTS (
    SELECT 1 FROM public.candidate_matches m
    WHERE m.candidate_profile_id = _candidate_profile_id
      AND m.organization_id = _org
      AND m.stage::text IN ('delivered', 'shortlisted', 'interview_process', 'offer', 'hired')
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'in_process');
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

REVOKE EXECUTE ON FUNCTION public.outreach_contact_allowed(uuid, uuid, outreach_channel) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.outreach_contact_allowed(uuid, uuid, outreach_channel) TO authenticated, service_role;
-- 1. outreach_contact_allowed: match email-only opt-outs, honour granted exceptions,
--    and return the detail the admin UI needs to explain a block.
CREATE OR REPLACE FUNCTION public.outreach_contact_allowed(_org uuid, _candidate_profile_id uuid, _channel outreach_channel)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _rule public.outreach_channel_rules%ROWTYPE;
  _max int := 1;
  _window int := 168;
  _recent int;
  _optout public.outreach_opt_outs%ROWTYPE;
  _email citext;
  _exception_id uuid;
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

  SELECT cp.email INTO _email
  FROM public.candidate_profiles cp
  WHERE cp.id = _candidate_profile_id;

  -- Suppression: by profile, or by the person's email address (list-level
  -- unsubscribes arrive without a profile attached).
  SELECT * INTO _optout
  FROM public.outreach_opt_outs o
  WHERE (o.channel IS NULL OR o.channel = _channel)
    AND (o.organization_id IS NULL OR o.organization_id = _org)
    AND (
      o.candidate_profile_id = _candidate_profile_id
      OR (_email IS NOT NULL AND o.email IS NOT NULL AND o.email = _email)
    )
  ORDER BY o.created_at ASC
  LIMIT 1;

  IF FOUND THEN
    -- A granted, unrevoked, unexpired exception is the only way past a suppression.
    SELECT e.id INTO _exception_id
    FROM public.eligibility_exceptions e
    JOIN public.eligibility_checks c ON c.id = e.eligibility_check_id
    JOIN public.candidate_matches m ON m.id = e.candidate_match_id
    WHERE e.organization_id = _org
      AND m.candidate_profile_id = _candidate_profile_id
      AND c.qualifier_key = 'outreach_contact_suppression'
      AND e.revoked_at IS NULL
      AND (e.expires_at IS NULL OR e.expires_at > now())
    ORDER BY e.created_at DESC
    LIMIT 1;

    IF _exception_id IS NULL THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'opted_out',
        'opt_out_id', _optout.id,
        'opt_out_reason', _optout.reason,
        'opt_out_at', _optout.created_at,
        'opt_out_channel', _optout.channel,
        'opt_out_scope', CASE WHEN _optout.organization_id IS NULL THEN 'global' ELSE 'organization' END,
        'matched_by', CASE WHEN _optout.candidate_profile_id = _candidate_profile_id THEN 'profile' ELSE 'email' END
      );
    END IF;
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

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', null,
    'exception_id', _exception_id
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.outreach_contact_allowed(uuid, uuid, outreach_channel) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.outreach_contact_allowed(uuid, uuid, outreach_channel) TO authenticated, service_role;

-- 2. The insert guard now covers every outbound touch, not only queued/sent rows,
--    so a suppressed contact cannot be written in as 'delivered' to skip the check.
CREATE OR REPLACE FUNCTION public.tg_outreach_touch_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _verdict jsonb;
BEGIN
  IF NEW.direction <> 'outbound' THEN
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
$function$;
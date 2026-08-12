CREATE OR REPLACE FUNCTION public.tg_graph_edge_generic()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _person uuid;
  _kind text := TG_ARGV[0];
  _cp uuid;
  _org uuid;
  _pos uuid;
  _match uuid;
  _payload jsonb := '{}'::jsonb;
  _at timestamptz := now();
BEGIN
  IF TG_TABLE_NAME = 'applications' THEN
    _cp := NEW.candidate_profile_id; _pos := NEW.position_id;
    SELECT p.organization_id INTO _org FROM public.positions p WHERE p.id = NEW.position_id;
    _payload := jsonb_build_object('status', NEW.status);
  ELSIF TG_TABLE_NAME = 'candidate_stage_history' THEN
    _cp := NEW.candidate_profile_id; _org := NEW.organization_id; _pos := NEW.position_id; _match := NEW.candidate_match_id;
    _payload := jsonb_build_object('from_stage', NEW.from_stage, 'to_stage', NEW.to_stage, 'reason', NEW.reason);
  ELSIF TG_TABLE_NAME = 'score_runs' THEN
    IF NEW.status::text <> 'completed' THEN RETURN NEW; END IF;
    _cp := NEW.candidate_profile_id; _org := NEW.organization_id; _pos := NEW.position_id; _match := NEW.candidate_match_id;
    _payload := jsonb_build_object('score', NEW.score, 'band', NEW.fit_band);
  ELSIF TG_TABLE_NAME = 'outreach_touches' THEN
    _cp := NEW.candidate_profile_id; _org := NEW.organization_id;
    _payload := jsonb_build_object('channel', NEW.channel, 'state', NEW.state, 'reply_category', NEW.reply_category);
    _at := COALESCE(NEW.sent_at, now());
  ELSIF TG_TABLE_NAME = 'hire_records' THEN
    _cp := NEW.candidate_profile_id; _org := NEW.organization_id; _pos := NEW.position_id; _match := NEW.candidate_match_id;
    _payload := jsonb_build_object('status', NEW.status, 'salary_amount', NEW.salary_amount, 'salary_currency', NEW.salary_currency);
  ELSIF TG_TABLE_NAME = 'interviews' THEN
    -- interviews has no candidate_profile_id column: derive it from the match.
    _org := NEW.organization_id; _pos := NEW.position_id; _match := NEW.candidate_match_id;
    SELECT cm.candidate_profile_id INTO _cp
      FROM public.candidate_matches cm WHERE cm.id = NEW.candidate_match_id;
    _payload := jsonb_build_object('status', NEW.status);
  END IF;

  IF _cp IS NULL THEN RETURN NEW; END IF;
  _person := public.person_for_candidate_profile(_cp);
  IF _person IS NULL THEN
    SELECT public.resolve_talent_person(cp.id, cp.email, cp.phone, cp.linkedin_url, cp.user_id, cp.full_name)
      INTO _person FROM public.candidate_profiles cp WHERE cp.id = _cp;
  END IF;
  IF _person IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.talent_graph_edges (
    person_id, edge_kind, organization_id, position_id, candidate_profile_id,
    candidate_match_id, source_table, source_id, occurred_at, payload
  ) VALUES (
    _person, _kind, _org, _pos, _cp, _match, TG_TABLE_NAME, NEW.id, _at, _payload
  )
  ON CONFLICT (edge_kind, source_table, source_id)
  DO UPDATE SET payload = EXCLUDED.payload, occurred_at = EXCLUDED.occurred_at;

  RETURN NEW;
END;
$function$;
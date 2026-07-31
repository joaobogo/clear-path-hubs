-- =========================================================
-- TALENT GRAPH: canonical person layer
-- =========================================================
CREATE TABLE public.talent_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text,
  primary_email citext,
  merged_into_id uuid REFERENCES public.talent_persons(id) ON DELETE SET NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.talent_persons TO authenticated;
GRANT ALL ON public.talent_persons TO service_role;
ALTER TABLE public.talent_persons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read talent persons" ON public.talent_persons
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));

CREATE TABLE public.talent_person_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.talent_persons(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('email','phone','linkedin','candidate_profile','auth_user')),
  value citext NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, value)
);

CREATE INDEX idx_tpi_person ON public.talent_person_identifiers(person_id);

GRANT SELECT ON public.talent_person_identifiers TO authenticated;
GRANT ALL ON public.talent_person_identifiers TO service_role;
ALTER TABLE public.talent_person_identifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read identifiers" ON public.talent_person_identifiers
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));

CREATE POLICY "Candidates read own person" ON public.talent_persons
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.talent_person_identifiers i
      JOIN public.candidate_profiles cp ON cp.id::text = i.value::text
      WHERE i.person_id = talent_persons.id
        AND i.kind = 'candidate_profile'
        AND cp.user_id = auth.uid()
    )
  );

CREATE TABLE public.talent_graph_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.talent_persons(id) ON DELETE CASCADE,
  edge_kind text NOT NULL CHECK (edge_kind IN ('role_seen','evidence','interaction','outcome','stage_change')),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  position_id uuid REFERENCES public.positions(id) ON DELETE CASCADE,
  candidate_profile_id uuid REFERENCES public.candidate_profiles(id) ON DELETE SET NULL,
  candidate_match_id uuid REFERENCES public.candidate_matches(id) ON DELETE SET NULL,
  source_table text NOT NULL,
  source_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (edge_kind, source_table, source_id)
);

CREATE INDEX idx_tge_person ON public.talent_graph_edges(person_id, occurred_at DESC);
CREATE INDEX idx_tge_org ON public.talent_graph_edges(organization_id, occurred_at DESC);
CREATE INDEX idx_tge_position ON public.talent_graph_edges(position_id);

GRANT SELECT ON public.talent_graph_edges TO authenticated;
GRANT ALL ON public.talent_graph_edges TO service_role;
ALTER TABLE public.talent_graph_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read graph edges" ON public.talent_graph_edges
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));

CREATE POLICY "Org members read own graph edges" ON public.talent_graph_edges
  FOR SELECT TO authenticated USING (
    organization_id IS NOT NULL AND public.is_org_member(auth.uid(), organization_id)
  );

-- =========================================================
-- Identity resolution
-- =========================================================
CREATE OR REPLACE FUNCTION public.resolve_talent_person(
  _candidate_profile_id uuid DEFAULT NULL,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _linkedin text DEFAULT NULL,
  _auth_user_id uuid DEFAULT NULL,
  _display_name text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _keys jsonb := '[]'::jsonb;
  _found uuid[];
  _winner uuid;
  _loser uuid;
  _k jsonb;
BEGIN
  IF _candidate_profile_id IS NOT NULL THEN
    _keys := _keys || jsonb_build_array(jsonb_build_object('kind','candidate_profile','value',_candidate_profile_id::text));
  END IF;
  IF _auth_user_id IS NOT NULL THEN
    _keys := _keys || jsonb_build_array(jsonb_build_object('kind','auth_user','value',_auth_user_id::text));
  END IF;
  IF _email IS NOT NULL AND btrim(_email) <> '' THEN
    _keys := _keys || jsonb_build_array(jsonb_build_object('kind','email','value',lower(btrim(_email))));
  END IF;
  IF _phone IS NOT NULL AND length(regexp_replace(_phone,'[^0-9]','','g')) >= 8 THEN
    _keys := _keys || jsonb_build_array(jsonb_build_object('kind','phone','value',right(regexp_replace(_phone,'[^0-9]','','g'), 10)));
  END IF;
  IF _linkedin IS NOT NULL AND btrim(_linkedin) <> '' THEN
    _keys := _keys || jsonb_build_array(jsonb_build_object('kind','linkedin','value',lower(regexp_replace(btrim(_linkedin), '^https?://(www\.)?', ''))));
  END IF;

  IF jsonb_array_length(_keys) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT array_agg(DISTINCT COALESCE(p.merged_into_id, p.id))
    INTO _found
  FROM public.talent_person_identifiers i
  JOIN public.talent_persons p ON p.id = i.person_id
  WHERE (i.kind, i.value) IN (
    SELECT (e->>'kind'), (e->>'value')::citext FROM jsonb_array_elements(_keys) e
  );

  IF _found IS NULL OR array_length(_found,1) = 0 THEN
    INSERT INTO public.talent_persons (display_name, primary_email)
    VALUES (_display_name, NULLIF(lower(btrim(COALESCE(_email,''))),''))
    RETURNING id INTO _winner;
  ELSE
    SELECT id INTO _winner FROM public.talent_persons
    WHERE id = ANY(_found) ORDER BY first_seen_at ASC, id ASC LIMIT 1;

    -- merge any others into the oldest
    FOR _loser IN
      SELECT id FROM public.talent_persons WHERE id = ANY(_found) AND id <> _winner
    LOOP
      UPDATE public.talent_person_identifiers SET person_id = _winner WHERE person_id = _loser;
      UPDATE public.talent_graph_edges SET person_id = _winner WHERE person_id = _loser;
      UPDATE public.talent_persons SET merged_into_id = _winner, updated_at = now() WHERE id = _loser;
    END LOOP;
  END IF;

  FOR _k IN SELECT * FROM jsonb_array_elements(_keys)
  LOOP
    INSERT INTO public.talent_person_identifiers (person_id, kind, value)
    VALUES (_winner, _k->>'kind', (_k->>'value')::citext)
    ON CONFLICT (kind, value) DO UPDATE SET last_seen_at = now(), updated_at = now();
  END LOOP;

  UPDATE public.talent_persons
     SET last_seen_at = now(),
         updated_at = now(),
         display_name = COALESCE(talent_persons.display_name, _display_name),
         primary_email = COALESCE(talent_persons.primary_email, NULLIF(lower(btrim(COALESCE(_email,''))),''))
   WHERE id = _winner;

  RETURN _winner;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_talent_person(uuid,text,text,text,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_talent_person(uuid,text,text,text,uuid,text) TO service_role;

-- helper: person for a candidate profile
CREATE OR REPLACE FUNCTION public.person_for_candidate_profile(_cp uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(p.merged_into_id, p.id)
  FROM public.talent_person_identifiers i
  JOIN public.talent_persons p ON p.id = i.person_id
  WHERE i.kind = 'candidate_profile' AND i.value = _cp::text::citext
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.person_for_candidate_profile(uuid) TO authenticated, service_role;

-- =========================================================
-- Automatic graph writers
-- =========================================================
CREATE OR REPLACE FUNCTION public.tg_graph_candidate_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.resolve_talent_person(
    NEW.id, NEW.email, NEW.phone, NEW.linkedin_url, NEW.user_id, NEW.full_name
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_graph_candidate_profile
AFTER INSERT OR UPDATE OF email, phone, linkedin_url, user_id ON public.candidate_profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_graph_candidate_profile();

CREATE OR REPLACE FUNCTION public.tg_graph_edge_generic()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    _cp := NEW.candidate_profile_id; _org := NEW.organization_id; _pos := NEW.position_id;
    _payload := jsonb_build_object('status', NEW.status);
  ELSIF TG_TABLE_NAME = 'candidate_stage_history' THEN
    _cp := NEW.candidate_profile_id; _org := NEW.organization_id; _pos := NEW.position_id; _match := NEW.candidate_match_id;
    _payload := jsonb_build_object('from_stage', NEW.from_stage, 'to_stage', NEW.to_stage, 'reason', NEW.reason);
  ELSIF TG_TABLE_NAME = 'score_runs' THEN
    IF NEW.status::text <> 'completed' THEN RETURN NEW; END IF;
    _cp := NEW.candidate_profile_id; _org := NEW.organization_id; _pos := NEW.position_id; _match := NEW.candidate_match_id;
    _payload := jsonb_build_object('score', NEW.overall_score, 'band', NEW.band);
  ELSIF TG_TABLE_NAME = 'outreach_touches' THEN
    _cp := NEW.candidate_profile_id; _org := NEW.organization_id;
    _payload := jsonb_build_object('channel', NEW.channel, 'state', NEW.state, 'reply_category', NEW.reply_category);
    _at := COALESCE(NEW.sent_at, now());
  ELSIF TG_TABLE_NAME = 'hire_records' THEN
    _cp := NEW.candidate_profile_id; _org := NEW.organization_id; _pos := NEW.position_id; _match := NEW.candidate_match_id;
    _payload := jsonb_build_object('status', NEW.status, 'salary_amount', NEW.salary_amount, 'salary_currency', NEW.salary_currency);
  ELSIF TG_TABLE_NAME = 'interviews' THEN
    _cp := NEW.candidate_profile_id; _org := NEW.organization_id; _pos := NEW.position_id; _match := NEW.candidate_match_id;
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
$$;

CREATE TRIGGER tg_graph_applications AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.tg_graph_edge_generic('role_seen');
CREATE TRIGGER tg_graph_stage AFTER INSERT ON public.candidate_stage_history
  FOR EACH ROW EXECUTE FUNCTION public.tg_graph_edge_generic('stage_change');
CREATE TRIGGER tg_graph_scores AFTER INSERT OR UPDATE ON public.score_runs
  FOR EACH ROW EXECUTE FUNCTION public.tg_graph_edge_generic('evidence');
CREATE TRIGGER tg_graph_outreach AFTER INSERT OR UPDATE ON public.outreach_touches
  FOR EACH ROW EXECUTE FUNCTION public.tg_graph_edge_generic('interaction');
CREATE TRIGGER tg_graph_hires AFTER INSERT OR UPDATE ON public.hire_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_graph_edge_generic('outcome');
CREATE TRIGGER tg_graph_interviews AFTER INSERT OR UPDATE ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.tg_graph_edge_generic('interaction');

-- backfill existing candidates into the graph
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, email, phone, linkedin_url, user_id, full_name FROM public.candidate_profiles LOOP
    PERFORM public.resolve_talent_person(r.id, r.email, r.phone, r.linkedin_url, r.user_id, r.full_name);
  END LOOP;
END $$;

-- =========================================================
-- Compounding write-back: search signals
-- =========================================================
CREATE TABLE public.search_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  position_id uuid REFERENCES public.positions(id) ON DELETE CASCADE,
  candidate_profile_id uuid REFERENCES public.candidate_profiles(id) ON DELETE SET NULL,
  person_id uuid REFERENCES public.talent_persons(id) ON DELETE SET NULL,
  signal_kind text NOT NULL CHECK (signal_kind IN (
    'evidence_predicted_hire','requirement_realism','accepted_package','stage_duration','dropout_point','offer_outcome'
  )),
  signal_key text NOT NULL,
  numeric_value numeric,
  text_value text,
  currency text,
  role_family text,
  region text,
  seniority text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (position_id, signal_kind, signal_key, candidate_profile_id)
);

CREATE INDEX idx_search_signals_family ON public.search_signals(role_family, region, signal_kind);
CREATE INDEX idx_search_signals_org ON public.search_signals(organization_id);

GRANT SELECT ON public.search_signals TO authenticated;
GRANT ALL ON public.search_signals TO service_role;
ALTER TABLE public.search_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read search signals" ON public.search_signals
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));
CREATE POLICY "Org members read own signals" ON public.search_signals
  FOR SELECT TO authenticated USING (
    organization_id IS NOT NULL AND public.is_org_member(auth.uid(), organization_id)
  );

-- normalise a job title into a role family
CREATE OR REPLACE FUNCTION public.role_family_of(_title text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _title IS NULL THEN 'unclassified'
    WHEN _title ~* '(software|engineer|developer|programmer|sre|devops)' THEN 'engineering'
    WHEN _title ~* '(data|analyt|scientist|machine learning|ml )' THEN 'data'
    WHEN _title ~* '(product manager|product owner|product lead)' THEN 'product'
    WHEN _title ~* '(design|ux|ui )' THEN 'design'
    WHEN _title ~* '(sales|account executive|business development|bdr|sdr)' THEN 'sales'
    WHEN _title ~* '(market|brand|growth|content)' THEN 'marketing'
    WHEN _title ~* '(finance|account|controller|audit|treasur)' THEN 'finance'
    WHEN _title ~* '(nurse|clinic|physician|doctor|care)' THEN 'healthcare'
    WHEN _title ~* '(hr|people|talent|recruit)' THEN 'people'
    WHEN _title ~* '(operation|logistic|supply|warehouse)' THEN 'operations'
    WHEN _title ~* '(legal|counsel|compliance)' THEN 'legal'
    WHEN _title ~* '(chef|hotel|hospitality|restaurant|front office)' THEN 'hospitality'
    ELSE 'unclassified'
  END;
$$;

GRANT EXECUTE ON FUNCTION public.role_family_of(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.write_back_closed_search(_position_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _pos public.positions%ROWTYPE;
  _family text; _region text; _written int := 0;
  _hire public.hire_records%ROWTYPE;
BEGIN
  SELECT * INTO _pos FROM public.positions WHERE id = _position_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'position_not_found'); END IF;
  IF _pos.closed_at IS NULL AND _pos.status::text NOT IN ('filled','closed','archived') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'search_not_closed');
  END IF;

  _family := public.role_family_of(_pos.title);
  _region := COALESCE(NULLIF(btrim(_pos.region),''), NULLIF(btrim(_pos.location),''), 'unspecified');

  -- 1. stage durations, measured from real stage history
  INSERT INTO public.search_signals (
    organization_id, position_id, signal_kind, signal_key, numeric_value,
    role_family, region, seniority, payload, observed_at
  )
  SELECT _pos.organization_id, _pos.id, 'stage_duration', s.to_stage,
         EXTRACT(EPOCH FROM (s.created_at - _pos.published_at)) / 86400.0,
         _family, _region, _pos.seniority,
         jsonb_build_object('measured_from','published_at','matches', 1), s.created_at
  FROM (
    SELECT DISTINCT ON (to_stage) to_stage, created_at
    FROM public.candidate_stage_history
    WHERE position_id = _pos.id
    ORDER BY to_stage, created_at ASC
  ) s
  WHERE _pos.published_at IS NOT NULL
  ON CONFLICT (position_id, signal_kind, signal_key, candidate_profile_id) DO NOTHING;
  GET DIAGNOSTICS _written = ROW_COUNT;

  -- 2. drop-out points: last stage reached per candidate that did not end hired
  INSERT INTO public.search_signals (
    organization_id, position_id, candidate_profile_id, person_id, signal_kind, signal_key,
    numeric_value, role_family, region, seniority, observed_at
  )
  SELECT _pos.organization_id, _pos.id, m.candidate_profile_id,
         public.person_for_candidate_profile(m.candidate_profile_id),
         'dropout_point', m.stage::text, 1, _family, _region, _pos.seniority, now()
  FROM public.candidate_matches m
  WHERE m.position_id = _pos.id AND m.stage::text NOT IN ('hired')
  ON CONFLICT (position_id, signal_kind, signal_key, candidate_profile_id) DO NOTHING;

  -- 3. accepted package + evidence that went with the hire + offer outcome
  FOR _hire IN
    SELECT * FROM public.hire_records WHERE position_id = _pos.id
  LOOP
    IF _hire.status::text = 'hired' AND _hire.salary_amount IS NOT NULL THEN
      INSERT INTO public.search_signals (
        organization_id, position_id, candidate_profile_id, person_id, signal_kind, signal_key,
        numeric_value, currency, role_family, region, seniority, payload, observed_at
      ) VALUES (
        _pos.organization_id, _pos.id, _hire.candidate_profile_id,
        public.person_for_candidate_profile(_hire.candidate_profile_id),
        'accepted_package', 'base', _hire.salary_amount, COALESCE(_hire.salary_currency,'USD'),
        _family, _region, _pos.seniority,
        jsonb_build_object('period', _hire.salary_period, 'employment_type', _hire.employment_type),
        COALESCE(_hire.accepted_at, _hire.hired_at, now())
      ) ON CONFLICT (position_id, signal_kind, signal_key, candidate_profile_id) DO NOTHING;

      -- which evidence predicted the hire
      INSERT INTO public.search_signals (
        organization_id, position_id, candidate_profile_id, person_id, signal_kind, signal_key,
        numeric_value, role_family, region, seniority, payload, observed_at
      )
      SELECT _pos.organization_id, _pos.id, _hire.candidate_profile_id,
             public.person_for_candidate_profile(_hire.candidate_profile_id),
             'evidence_predicted_hire', ei.rubric_criterion_key,
             ei.confidence, _family, _region, _pos.seniority,
             jsonb_build_object('match_type', ei.match_type, 'result', ei.result), now()
      FROM public.candidate_evidence_items ei
      WHERE ei.candidate_match_id = _hire.candidate_match_id
      ON CONFLICT (position_id, signal_kind, signal_key, candidate_profile_id) DO NOTHING;
    END IF;

    INSERT INTO public.search_signals (
      organization_id, position_id, candidate_profile_id, person_id, signal_kind, signal_key,
      numeric_value, role_family, region, seniority, observed_at
    ) VALUES (
      _pos.organization_id, _pos.id, _hire.candidate_profile_id,
      public.person_for_candidate_profile(_hire.candidate_profile_id),
      'offer_outcome', _hire.status::text, 1, _family, _region, _pos.seniority,
      COALESCE(_hire.closed_at, _hire.updated_at, now())
    ) ON CONFLICT (position_id, signal_kind, signal_key, candidate_profile_id) DO NOTHING;
  END LOOP;

  -- 4. requirement realism: how many applicants actually cleared each requirement
  INSERT INTO public.search_signals (
    organization_id, position_id, signal_kind, signal_key, numeric_value,
    role_family, region, seniority, payload, observed_at
  )
  SELECT _pos.organization_id, _pos.id, 'requirement_realism', ei.rubric_criterion_key,
         ROUND(AVG(CASE WHEN ei.result = 'met' THEN 1 ELSE 0 END)::numeric, 4),
         _family, _region, _pos.seniority,
         jsonb_build_object('sample_size', COUNT(*)), now()
  FROM public.candidate_evidence_items ei
  JOIN public.candidate_matches m ON m.id = ei.candidate_match_id
  WHERE m.position_id = _pos.id AND ei.rubric_criterion_key IS NOT NULL
  GROUP BY ei.rubric_criterion_key
  ON CONFLICT (position_id, signal_kind, signal_key, candidate_profile_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'position_id', _pos.id, 'role_family', _family, 'region', _region);
END;
$$;

REVOKE ALL ON FUNCTION public.write_back_closed_search(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.write_back_closed_search(uuid) TO authenticated, service_role;

-- run the write-back automatically when a search closes
CREATE OR REPLACE FUNCTION public.tg_writeback_on_close()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status::text IN ('filled','closed') AND COALESCE(OLD.status::text,'') <> NEW.status::text THEN
    PERFORM public.write_back_closed_search(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_positions_writeback
AFTER UPDATE OF status ON public.positions
FOR EACH ROW EXECUTE FUNCTION public.tg_writeback_on_close();

-- =========================================================
-- Market intelligence, always carrying its sample size
-- =========================================================
CREATE OR REPLACE VIEW public.market_intelligence
WITH (security_invoker = true) AS
SELECT
  s.role_family,
  s.region,
  s.signal_kind,
  s.signal_key,
  COUNT(DISTINCT s.position_id)::int AS closed_searches,
  COUNT(*)::int AS record_count,
  ROUND(AVG(s.numeric_value), 2) AS avg_value,
  ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY s.numeric_value)::numeric, 2) AS median_value,
  MIN(s.observed_at) AS window_start,
  MAX(s.observed_at) AS window_end,
  MAX(s.currency) AS currency
FROM public.search_signals s
WHERE s.numeric_value IS NOT NULL
GROUP BY s.role_family, s.region, s.signal_kind, s.signal_key;

GRANT SELECT ON public.market_intelligence TO authenticated;
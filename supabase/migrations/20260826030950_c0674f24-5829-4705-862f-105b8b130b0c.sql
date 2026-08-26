CREATE OR REPLACE FUNCTION public.demo_backdate(_table text, _id uuid, _patch jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed text[] := ARRAY[
    'positions','candidate_matches','candidate_stage_history','client_decisions',
    'interviews','interview_scorecards','hire_records','score_runs','applications',
    'candidate_profiles','files','candidate_evidence','candidate_evidence_items',
    'audit_events','notification_events','internal_notes','talent_memory',
    'talent_memory_events','talent_pool_members','messages','conversations',
    'score_decisions','eligibility_checks','processing_jobs','notifications'
  ];
  k text;
  v jsonb;
  sets text := '';
  has_org boolean;
  has_marker boolean;
  ok boolean;
BEGIN
  IF NOT (_table = ANY(allowed)) THEN
    RAISE EXCEPTION 'demo_backdate: table % is not backdatable', _table;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=_table AND column_name='organization_id'
  ) INTO has_org;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=_table AND column_name='legacy_source_system'
  ) INTO has_marker;

  IF has_org THEN
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM public.%I t JOIN public.organizations o ON o.id = t.organization_id WHERE t.id = $1 AND o.is_demo IS TRUE)',
      _table
    ) INTO ok USING _id;
  ELSIF has_marker THEN
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM public.%I t WHERE t.id = $1 AND t.legacy_source_system IS NOT NULL)',
      _table
    ) INTO ok USING _id;
  ELSE
    ok := false;
  END IF;

  IF NOT ok THEN
    RAISE EXCEPTION 'demo_backdate: row % in % is not part of a demo workspace', _id, _table;
  END IF;

  FOR k, v IN SELECT key, value FROM jsonb_each(_patch) LOOP
    IF k !~ '(_at|_on|_date)$' THEN
      RAISE EXCEPTION 'demo_backdate: column % is not a date/time column', k;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=_table AND column_name=k
        AND data_type IN ('timestamp with time zone','timestamp without time zone','date')
    ) THEN
      RAISE EXCEPTION 'demo_backdate: column %.% is not a date/time column', _table, k;
    END IF;
    sets := sets || format('%I = %L, ', k, v #>> '{}');
  END LOOP;

  IF sets = '' THEN RETURN; END IF;
  sets := left(sets, length(sets) - 2);

  -- Historical dates only: user triggers (touch/updated_at, version snapshots,
  -- history guards) must not rewrite what we set. Session-scoped and reverted
  -- when the statement ends.
  PERFORM set_config('session_replication_role', 'replica', true);
  EXECUTE format('UPDATE public.%I SET %s WHERE id = $1', _table, sets) USING _id;
  PERFORM set_config('session_replication_role', 'origin', true);
END;
$$;

REVOKE ALL ON FUNCTION public.demo_backdate(text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.demo_backdate(text, uuid, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_backdate(text, uuid, jsonb) TO service_role;
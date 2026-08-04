-- Task A: flag test/internal organizations (idempotent, reversible)
-- Rollback: UPDATE public.organizations SET is_test_record = NULL WHERE is_test_record = true;

DO $$
DECLARE
  _protected text[] := ARRAY['Flow Group Ventures', 'Bob law'];
BEGIN
  UPDATE public.organizations o
     SET is_test_record = true
   WHERE o.is_test_record IS DISTINCT FROM true
     AND o.name <> ALL (_protected)
     AND (
       o.name IN ('CB Test Company', 'Rehearsal Hotels Ltd', 'Rehearsal Hotels 489631', 'TaaSFlow Platform', 'taasflow')
       OR o.name ILIKE '%rehearsal%'
       OR o.name ILIKE '%test company%'
     );
END $$;

-- Cascade to downstream tables that already have both is_test_record and a clean org FK.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='positions' AND column_name='is_test_record'
  ) THEN
    UPDATE public.positions p
       SET is_test_record = true
      FROM public.organizations o
     WHERE o.id = p.organization_id
       AND o.is_test_record = true
       AND p.is_test_record IS DISTINCT FROM true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='applications' AND column_name='is_test_record'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='applications' AND column_name='position_id'
  ) THEN
    UPDATE public.applications a
       SET is_test_record = true
      FROM public.positions p
      JOIN public.organizations o ON o.id = p.organization_id
     WHERE p.id = a.position_id
       AND o.is_test_record = true
       AND a.is_test_record IS DISTINCT FROM true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='candidate_matches' AND column_name='is_test_record'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='candidate_matches' AND column_name='position_id'
  ) THEN
    UPDATE public.candidate_matches m
       SET is_test_record = true
      FROM public.positions p
      JOIN public.organizations o ON o.id = p.organization_id
     WHERE p.id = m.position_id
       AND o.is_test_record = true
       AND m.is_test_record IS DISTINCT FROM true;
  END IF;
END $$;

-- Index to keep the "hide test records" filters cheap.
CREATE INDEX IF NOT EXISTS organizations_is_test_record_idx
  ON public.organizations (is_test_record)
  WHERE is_test_record = true;

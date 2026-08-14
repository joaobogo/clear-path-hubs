-- Test-record flags were nullable with no default. Filters written as
-- "is_test_record = false" therefore dropped every real row (NULL), which made
-- several dashboard lists and KPI tiles under-report. Backfill + default so the
-- flag is always a real boolean. Additive and reversible (drop default, allow NULL).
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'is_test_record'
      AND c.is_nullable = 'YES'
  LOOP
    EXECUTE format('UPDATE public.%I SET is_test_record = false WHERE is_test_record IS NULL', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN is_test_record SET DEFAULT false', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN is_test_record SET NOT NULL', t);
  END LOOP;
END $$;
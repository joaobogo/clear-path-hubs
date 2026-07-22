DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizations','positions','applications','candidate_matches',
    'candidate_profiles','memberships','profiles','files'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I
      ADD COLUMN IF NOT EXISTS is_test_record boolean,
      ADD COLUMN IF NOT EXISTS test_run_id text,
      ADD COLUMN IF NOT EXISTS created_by_audit boolean,
      ADD COLUMN IF NOT EXISTS expires_at timestamptz', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(test_run_id) WHERE test_run_id IS NOT NULL',
      t || '_test_run_id_idx', t);
  END LOOP;
END $$;
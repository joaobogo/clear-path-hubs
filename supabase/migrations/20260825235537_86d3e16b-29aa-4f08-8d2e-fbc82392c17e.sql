DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'interviews'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.interviews;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'memberships'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.memberships;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'hire_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hire_records;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'client_decisions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.client_decisions;
  END IF;
END
$$;

ALTER TABLE public.interviews REPLICA IDENTITY FULL;
ALTER TABLE public.memberships REPLICA IDENTITY FULL;
ALTER TABLE public.hire_records REPLICA IDENTITY FULL;
ALTER TABLE public.client_decisions REPLICA IDENTITY FULL;
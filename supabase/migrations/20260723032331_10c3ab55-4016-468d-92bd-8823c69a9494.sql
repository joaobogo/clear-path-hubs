
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_interviews') THEN
    CREATE TRIGGER audit_interviews
      AFTER INSERT OR UPDATE OR DELETE ON public.interviews
      FOR EACH ROW EXECUTE FUNCTION public.tg_write_audit_event();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_files') THEN
    CREATE TRIGGER audit_files
      AFTER INSERT OR UPDATE OR DELETE ON public.files
      FOR EACH ROW EXECUTE FUNCTION public.tg_write_audit_event();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_screening_questions') THEN
    CREATE TRIGGER audit_screening_questions
      AFTER INSERT OR UPDATE OR DELETE ON public.screening_questions
      FOR EACH ROW EXECUTE FUNCTION public.tg_write_audit_event();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_organizations') THEN
    CREATE TRIGGER audit_organizations
      AFTER INSERT OR UPDATE OR DELETE ON public.organizations
      FOR EACH ROW EXECUTE FUNCTION public.tg_write_audit_event();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_score_runs') THEN
    CREATE TRIGGER audit_score_runs
      AFTER INSERT OR UPDATE OR DELETE ON public.score_runs
      FOR EACH ROW EXECUTE FUNCTION public.tg_write_audit_event();
  END IF;
END $$;

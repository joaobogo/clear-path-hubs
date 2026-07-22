
DO $$
DECLARE fn text;
BEGIN
  FOR fn IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proname IN ('is_org_member','is_platform_staff','is_active_user',
                        'has_org_role','is_org_admin','is_org_editor','is_org_viewer',
                        'is_owning_candidate','has_role','tg_write_audit_event',
                        'tg_score_runs_immutable')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
  END LOOP;
END $$;

-- Trigger functions never need to be callable directly
REVOKE EXECUTE ON FUNCTION public.tg_score_runs_immutable() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_write_audit_event() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_touch_updated_at() FROM PUBLIC, anon, authenticated;

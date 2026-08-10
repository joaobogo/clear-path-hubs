-- `applications` was the only core mutation table without an audit trigger, so
-- candidate submissions, withdrawals, and status changes left no row-level trail.
-- It cannot use tg_write_audit_event: that function reads organization_id off the
-- row, and applications has no such column (org lives on the position). This
-- variant resolves the org through positions so the events are attributable.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS audit_applications ON public.applications;
--   DROP FUNCTION IF EXISTS public.tg_write_audit_event_application();

CREATE OR REPLACE FUNCTION public.tg_write_audit_event_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_org uuid;
  v_trace text := current_setting('app.trace_id', true);
  v_before jsonb;
  v_after jsonb;
  v_entity uuid;
  v_position uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_before := to_jsonb(OLD);
    v_after := NULL;
    v_entity := OLD.id;
    v_position := OLD.position_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    v_entity := NEW.id;
    v_position := NEW.position_id;
  ELSE
    v_before := NULL;
    v_after := to_jsonb(NEW);
    v_entity := NEW.id;
    v_position := NEW.position_id;
  END IF;

  -- Best-effort: an unattributed audit row is better than a failed mutation.
  BEGIN
    SELECT p.organization_id INTO v_org
      FROM public.positions p
     WHERE p.id = v_position;
  EXCEPTION WHEN others THEN
    v_org := NULL;
  END;

  INSERT INTO public.audit_events(
    actor_user_id, organization_id, entity_type, entity_id,
    action, before_state, after_state, trace_id
  ) VALUES (
    v_actor, v_org, TG_TABLE_NAME, v_entity,
    TG_OP, v_before, v_after, NULLIF(v_trace, '')
  );

  RETURN COALESCE(NEW, OLD);
END
$$;

REVOKE ALL ON FUNCTION public.tg_write_audit_event_application() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_write_audit_event_application() FROM anon, authenticated;

DROP TRIGGER IF EXISTS audit_applications ON public.applications;
CREATE TRIGGER audit_applications
  AFTER INSERT OR UPDATE OR DELETE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.tg_write_audit_event_application();

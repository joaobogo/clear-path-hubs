DO $$ BEGIN
  CREATE TYPE public.role_intensity AS ENUM ('steady','standard','aggressive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS intensity public.role_intensity NOT NULL DEFAULT 'standard';

CREATE OR REPLACE FUNCTION public.tg_positions_intensity_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.intensity IS DISTINCT FROM OLD.intensity THEN
    INSERT INTO public.audit_events (
      organization_id, entity_type, entity_id, action, actor_user_id,
      before_state, after_state
    ) VALUES (
      NEW.organization_id, 'position', NEW.id, 'position.intensity_changed', auth.uid(),
      jsonb_build_object('intensity', OLD.intensity),
      jsonb_build_object('intensity', NEW.intensity)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_positions_intensity_audit ON public.positions;
CREATE TRIGGER tg_positions_intensity_audit
  AFTER UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.tg_positions_intensity_audit();

CREATE TABLE IF NOT EXISTS public.integration_sync_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_key text NOT NULL,
  display_name text NOT NULL,
  state text NOT NULL DEFAULT 'not_connected',
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integration_sync_status_state_chk
    CHECK (state IN ('not_connected','healthy','degraded','failing')),
  CONSTRAINT integration_sync_status_unique UNIQUE (organization_id, integration_key)
);

GRANT SELECT ON public.integration_sync_status TO authenticated;
GRANT ALL ON public.integration_sync_status TO service_role;

ALTER TABLE public.integration_sync_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read integration status" ON public.integration_sync_status;
CREATE POLICY "members read integration status"
  ON public.integration_sync_status FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

DROP POLICY IF EXISTS "staff write integration status" ON public.integration_sync_status;
CREATE POLICY "staff write integration status"
  ON public.integration_sync_status FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid()) OR public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_platform_staff(auth.uid()) OR public.is_org_admin(auth.uid(), organization_id));

CREATE INDEX IF NOT EXISTS integration_sync_status_org_idx
  ON public.integration_sync_status (organization_id);
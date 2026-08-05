CREATE TABLE public.hire_handoff_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hire_id uuid NOT NULL REFERENCES public.hire_records(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  label text NOT NULL,
  sequence integer NOT NULL DEFAULT 0,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_label text,
  plan_source text,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hire_id, step_key)
);

CREATE INDEX hire_handoff_steps_hire_idx ON public.hire_handoff_steps (hire_id);
CREATE INDEX hire_handoff_steps_position_idx ON public.hire_handoff_steps (position_id);

GRANT SELECT, INSERT, UPDATE ON public.hire_handoff_steps TO authenticated;
GRANT ALL ON public.hire_handoff_steps TO service_role;

ALTER TABLE public.hire_handoff_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "handoff_steps_select_org_members"
ON public.hire_handoff_steps FOR SELECT TO authenticated
USING (
  public.is_org_member(auth.uid(), organization_id)
  OR public.is_platform_staff(auth.uid())
);

CREATE POLICY "handoff_steps_insert_org_editors"
ON public.hire_handoff_steps FOR INSERT TO authenticated
WITH CHECK (
  public.is_org_editor(auth.uid(), organization_id)
  OR public.is_platform_staff(auth.uid())
);

CREATE POLICY "handoff_steps_update_org_editors"
ON public.hire_handoff_steps FOR UPDATE TO authenticated
USING (
  public.is_org_editor(auth.uid(), organization_id)
  OR public.is_platform_staff(auth.uid())
)
WITH CHECK (
  public.is_org_editor(auth.uid(), organization_id)
  OR public.is_platform_staff(auth.uid())
);

CREATE TRIGGER hire_handoff_steps_touch_updated_at
BEFORE UPDATE ON public.hire_handoff_steps
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
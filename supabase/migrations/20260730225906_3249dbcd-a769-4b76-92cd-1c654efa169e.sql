CREATE TABLE public.recruiting_spend_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  category text NOT NULL DEFAULT 'subscription',
  note text,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recruiting_spend_period_valid CHECK (period_end >= period_start)
);

CREATE INDEX recruiting_spend_org_period_idx ON public.recruiting_spend_entries (organization_id, period_start, period_end);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recruiting_spend_entries TO authenticated;
GRANT ALL ON public.recruiting_spend_entries TO service_role;

ALTER TABLE public.recruiting_spend_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spend readable by org members and staff"
ON public.recruiting_spend_entries FOR SELECT TO authenticated
USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "spend insert by org admins and staff"
ON public.recruiting_spend_entries FOR INSERT TO authenticated
WITH CHECK (public.is_org_admin(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "spend update by org admins and staff"
ON public.recruiting_spend_entries FOR UPDATE TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()))
WITH CHECK (public.is_org_admin(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "spend delete by org admins and staff"
ON public.recruiting_spend_entries FOR DELETE TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE TRIGGER recruiting_spend_touch_updated_at
BEFORE UPDATE ON public.recruiting_spend_entries
FOR EACH ROW EXECUTE FUNCTION public._mig_touch_updated_at();
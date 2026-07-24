
-- Talent Pool + Rediscovery Layer
-- Adds saved pools of candidates and a well-known "Good for future" system pool per org.

CREATE TABLE public.talent_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  system_key text, -- e.g. 'good_for_future' for the well-known pool
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT talent_pools_unique_system_key UNIQUE (organization_id, system_key),
  CONSTRAINT talent_pools_unique_name UNIQUE (organization_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.talent_pools TO authenticated;
GRANT ALL ON public.talent_pools TO service_role;

ALTER TABLE public.talent_pools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pools_read_by_org_member"
  ON public.talent_pools FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "pools_write_by_org_editor"
  ON public.talent_pools FOR INSERT TO authenticated
  WITH CHECK (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "pools_update_by_org_editor"
  ON public.talent_pools FOR UPDATE TO authenticated
  USING (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "pools_delete_by_org_admin"
  ON public.talent_pools FOR DELETE TO authenticated
  USING ((public.is_org_admin(auth.uid(), organization_id) AND is_system = false) OR public.is_platform_staff(auth.uid()));

CREATE TRIGGER trg_talent_pools_touch
  BEFORE UPDATE ON public.talent_pools
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();


CREATE TABLE public.talent_pool_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.talent_pools(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  candidate_profile_id uuid NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  notes text,
  added_by uuid,
  added_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT talent_pool_members_unique UNIQUE (pool_id, candidate_profile_id)
);

CREATE INDEX talent_pool_members_org_idx ON public.talent_pool_members(organization_id);
CREATE INDEX talent_pool_members_cp_idx ON public.talent_pool_members(candidate_profile_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.talent_pool_members TO authenticated;
GRANT ALL ON public.talent_pool_members TO service_role;

ALTER TABLE public.talent_pool_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pool_members_read_by_org_member"
  ON public.talent_pool_members FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "pool_members_write_by_org_editor"
  ON public.talent_pool_members FOR INSERT TO authenticated
  WITH CHECK (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "pool_members_update_by_org_editor"
  ON public.talent_pool_members FOR UPDATE TO authenticated
  USING (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "pool_members_delete_by_org_editor"
  ON public.talent_pool_members FOR DELETE TO authenticated
  USING (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

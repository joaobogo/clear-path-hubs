
CREATE TYPE public.silver_reason AS ENUM (
  'role_filled','timing','comp_gap','level_mismatch','geo','better_fit_selected','skills_gap','other'
);

CREATE TYPE public.silver_consent AS ENUM ('granted','pending','declined','withdrawn');

CREATE TABLE public.talent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  candidate_profile_id uuid NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  source_match_id uuid REFERENCES public.candidate_matches(id) ON DELETE SET NULL,
  source_position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  reason_category public.silver_reason NOT NULL,
  reason_notes text,
  headline_snapshot text,
  seniority_snapshot text,
  role_title_snapshot text,
  skills_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  score_snapshot numeric,
  owner_user_id uuid,
  consent_status public.silver_consent NOT NULL DEFAULT 'pending',
  consent_updated_at timestamptz,
  consent_expires_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  last_resurfaced_at timestamptz,
  last_reengaged_at timestamptz,
  tagged_by uuid,
  tagged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, candidate_profile_id)
);

CREATE INDEX talent_memory_org_status_idx ON public.talent_memory(organization_id, status);
CREATE INDEX talent_memory_org_reason_idx ON public.talent_memory(organization_id, reason_category);
CREATE INDEX talent_memory_skills_gin ON public.talent_memory USING gin (skills_snapshot);

CREATE TABLE public.talent_memory_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_memory_id uuid NOT NULL REFERENCES public.talent_memory(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  actor_user_id uuid,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX talent_memory_events_mem_idx ON public.talent_memory_events(talent_memory_id, created_at DESC);
CREATE INDEX talent_memory_events_org_idx ON public.talent_memory_events(organization_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.talent_memory TO authenticated;
GRANT ALL ON public.talent_memory TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.talent_memory_events TO authenticated;
GRANT ALL ON public.talent_memory_events TO service_role;

ALTER TABLE public.talent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_memory_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "talent_memory org read"
  ON public.talent_memory FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "talent_memory editor write"
  ON public.talent_memory FOR INSERT TO authenticated
  WITH CHECK (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "talent_memory editor update"
  ON public.talent_memory FOR UPDATE TO authenticated
  USING (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "talent_memory editor delete"
  ON public.talent_memory FOR DELETE TO authenticated
  USING (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "talent_memory_events org read"
  ON public.talent_memory_events FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "talent_memory_events editor insert"
  ON public.talent_memory_events FOR INSERT TO authenticated
  WITH CHECK (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE TRIGGER trg_talent_memory_updated_at
  BEFORE UPDATE ON public.talent_memory
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

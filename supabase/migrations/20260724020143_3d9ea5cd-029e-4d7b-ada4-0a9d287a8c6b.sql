
CREATE TYPE public.role_memory_kind AS ENUM (
  'brief','rationale','handoff','candidate_reasoning','decision','risk','next_step'
);

CREATE TABLE public.role_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  candidate_profile_id UUID REFERENCES public.candidate_profiles(id) ON DELETE SET NULL,
  kind public.role_memory_kind NOT NULL DEFAULT 'rationale',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT false,
  author_user_id UUID NOT NULL,
  author_display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX role_memory_position_idx ON public.role_memory (position_id, pinned DESC, created_at DESC);
CREATE INDEX role_memory_org_idx ON public.role_memory (organization_id, created_at DESC);
CREATE INDEX role_memory_candidate_idx ON public.role_memory (candidate_profile_id) WHERE candidate_profile_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_memory TO authenticated;
GRANT ALL ON public.role_memory TO service_role;

ALTER TABLE public.role_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read role memory"
  ON public.role_memory FOR SELECT
  TO authenticated
  USING (
    public.is_platform_staff(auth.uid())
    OR public.is_org_member(organization_id, auth.uid())
  );

CREATE POLICY "editors insert role memory"
  ON public.role_memory FOR INSERT
  TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND (
      public.is_platform_staff(auth.uid())
      OR public.is_org_member(organization_id, auth.uid())
    )
  );

CREATE POLICY "authors or staff update role memory"
  ON public.role_memory FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_staff(auth.uid())
    OR author_user_id = auth.uid()
  );

CREATE POLICY "authors or staff delete role memory"
  ON public.role_memory FOR DELETE
  TO authenticated
  USING (
    public.is_platform_staff(auth.uid())
    OR author_user_id = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.tg_role_memory_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_role_memory_touch
  BEFORE UPDATE ON public.role_memory
  FOR EACH ROW EXECUTE FUNCTION public.tg_role_memory_touch();

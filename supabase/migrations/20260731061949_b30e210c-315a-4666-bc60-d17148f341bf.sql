CREATE TABLE public.internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('position','candidate_match','organization')),
  entity_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(btrim(body)) >= 2 AND length(body) <= 4000),
  kind text NOT NULL DEFAULT 'note' CHECK (kind IN ('note','handoff','risk','decision')),
  pinned boolean NOT NULL DEFAULT false,
  author_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX internal_notes_entity_idx ON public.internal_notes (entity_type, entity_id, created_at DESC);
CREATE INDEX internal_notes_org_idx ON public.internal_notes (organization_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_notes TO authenticated;
GRANT ALL ON public.internal_notes TO service_role;

ALTER TABLE public.internal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY internal_notes_staff_read ON public.internal_notes
  FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));

CREATE POLICY internal_notes_staff_write ON public.internal_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_staff(auth.uid()) AND author_user_id = auth.uid());

CREATE POLICY internal_notes_author_update ON public.internal_notes
  FOR UPDATE TO authenticated
  USING (public.is_platform_staff(auth.uid()) AND author_user_id = auth.uid())
  WITH CHECK (public.is_platform_staff(auth.uid()) AND author_user_id = auth.uid());

CREATE POLICY internal_notes_author_delete ON public.internal_notes
  FOR DELETE TO authenticated
  USING (public.is_platform_staff(auth.uid()) AND author_user_id = auth.uid());

CREATE TRIGGER internal_notes_touch_updated_at
  BEFORE UPDATE ON public.internal_notes
  FOR EACH ROW EXECUTE FUNCTION public.payments_touch_updated_at();

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

CREATE INDEX IF NOT EXISTS notifications_entity_idx
  ON public.notifications (entity_type, entity_id) WHERE entity_id IS NOT NULL;
CREATE TABLE public.duplicate_person_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_a_id uuid NOT NULL REFERENCES public.talent_persons(id) ON DELETE CASCADE,
  person_b_id uuid NOT NULL REFERENCES public.talent_persons(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('merged','distinct')),
  merged_into_id uuid REFERENCES public.talent_persons(id) ON DELETE SET NULL,
  moved_identifier_ids uuid[] NOT NULL DEFAULT '{}',
  note text,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reverted_at timestamptz,
  reverted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dpd_ordered CHECK (person_a_id < person_b_id)
);

CREATE UNIQUE INDEX dpd_active_pair_uq
  ON public.duplicate_person_decisions (person_a_id, person_b_id)
  WHERE reverted_at IS NULL;

CREATE INDEX dpd_person_a_ix ON public.duplicate_person_decisions (person_a_id);
CREATE INDEX dpd_person_b_ix ON public.duplicate_person_decisions (person_b_id);

GRANT SELECT ON public.duplicate_person_decisions TO authenticated;
GRANT ALL ON public.duplicate_person_decisions TO service_role;

ALTER TABLE public.duplicate_person_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read duplicate decisions"
  ON public.duplicate_person_decisions FOR SELECT
  TO authenticated
  USING (public.is_platform_staff(auth.uid()));

CREATE TRIGGER duplicate_person_decisions_touch
  BEFORE UPDATE ON public.duplicate_person_decisions
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TABLE public.parse_field_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_match_id uuid NOT NULL REFERENCES public.candidate_matches(id) ON DELETE CASCADE,
  candidate_profile_id uuid REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  field_path text NOT NULL,
  field_label text,
  machine_value jsonb,
  human_value jsonb,
  located boolean NOT NULL DEFAULT false,
  review_state text NOT NULL DEFAULT 'unreviewed',
  reviewer_note text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parse_field_reviews_state_chk CHECK (review_state IN ('unreviewed','confirmed','corrected','passage_mismatch')),
  CONSTRAINT parse_field_reviews_unique UNIQUE (candidate_match_id, field_path)
);

CREATE INDEX parse_field_reviews_match_idx ON public.parse_field_reviews (candidate_match_id);
CREATE INDEX parse_field_reviews_state_idx ON public.parse_field_reviews (review_state);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parse_field_reviews TO authenticated;
GRANT ALL ON public.parse_field_reviews TO service_role;

ALTER TABLE public.parse_field_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform staff read parse field reviews"
  ON public.parse_field_reviews FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));

CREATE POLICY "Platform staff write parse field reviews"
  ON public.parse_field_reviews FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_staff(auth.uid()));

CREATE POLICY "Platform staff update parse field reviews"
  ON public.parse_field_reviews FOR UPDATE TO authenticated
  USING (public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_platform_staff(auth.uid()));

CREATE POLICY "Platform staff delete parse field reviews"
  ON public.parse_field_reviews FOR DELETE TO authenticated
  USING (public.is_platform_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.parse_field_reviews_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER parse_field_reviews_updated_at
  BEFORE UPDATE ON public.parse_field_reviews
  FOR EACH ROW EXECUTE FUNCTION public.parse_field_reviews_touch_updated_at();
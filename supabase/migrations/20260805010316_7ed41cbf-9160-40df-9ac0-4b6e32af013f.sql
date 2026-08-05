CREATE TABLE public.scoring_review_claims (
  candidate_match_id uuid PRIMARY KEY REFERENCES public.candidate_matches(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX scoring_review_claims_reviewer_idx ON public.scoring_review_claims (reviewer_user_id, claimed_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scoring_review_claims TO authenticated;
GRANT ALL ON public.scoring_review_claims TO service_role;

ALTER TABLE public.scoring_review_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read review claims"
ON public.scoring_review_claims FOR SELECT TO authenticated
USING (public.is_platform_staff(auth.uid()));

CREATE POLICY "Staff can claim reviews"
ON public.scoring_review_claims FOR INSERT TO authenticated
WITH CHECK (public.is_platform_staff(auth.uid()) AND reviewer_user_id = auth.uid());

CREATE POLICY "Staff can release claims"
ON public.scoring_review_claims FOR DELETE TO authenticated
USING (
  public.is_platform_staff(auth.uid())
  AND (reviewer_user_id = auth.uid() OR public.is_platform_admin(auth.uid()))
);
CREATE TABLE public.interview_scorecards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  candidate_match_id uuid NOT NULL REFERENCES public.candidate_matches(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  reviewer_user_id uuid NOT NULL,
  reviewer_name text,
  criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendation text NOT NULL DEFAULT 'no_decision',
  strengths text,
  concerns text,
  summary text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interview_scorecards_recommendation_chk
    CHECK (recommendation IN ('strong_yes','yes','no_decision','no','strong_no')),
  CONSTRAINT interview_scorecards_unique_reviewer UNIQUE (interview_id, reviewer_user_id)
);

CREATE INDEX idx_interview_scorecards_match ON public.interview_scorecards (candidate_match_id);
CREATE INDEX idx_interview_scorecards_org ON public.interview_scorecards (organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_scorecards TO authenticated;
GRANT ALL ON public.interview_scorecards TO service_role;

ALTER TABLE public.interview_scorecards ENABLE ROW LEVEL SECURITY;

CREATE POLICY isc_read ON public.interview_scorecards FOR SELECT TO authenticated
USING (
  is_active_user(auth.uid())
  AND (
    is_platform_staff(auth.uid())
    OR is_match_client_visible(auth.uid(), candidate_match_id)
  )
);

CREATE POLICY isc_insert ON public.interview_scorecards FOR INSERT TO authenticated
WITH CHECK (
  is_active_user(auth.uid())
  AND reviewer_user_id = auth.uid()
  AND (
    is_platform_staff(auth.uid())
    OR (
      is_match_client_visible(auth.uid(), candidate_match_id)
      AND has_client_permission(auth.uid(), organization_id, 'add_feedback'::client_permission)
    )
  )
);

CREATE POLICY isc_update ON public.interview_scorecards FOR UPDATE TO authenticated
USING (
  is_active_user(auth.uid())
  AND (
    is_platform_staff(auth.uid())
    OR (
      reviewer_user_id = auth.uid()
      AND is_match_client_visible(auth.uid(), candidate_match_id)
      AND has_client_permission(auth.uid(), organization_id, 'add_feedback'::client_permission)
    )
  )
)
WITH CHECK (
  is_platform_staff(auth.uid())
  OR (
    reviewer_user_id = auth.uid()
    AND is_match_client_visible(auth.uid(), candidate_match_id)
    AND has_client_permission(auth.uid(), organization_id, 'add_feedback'::client_permission)
  )
);

CREATE POLICY isc_delete ON public.interview_scorecards FOR DELETE TO authenticated
USING (
  is_active_user(auth.uid())
  AND (is_platform_staff(auth.uid()) OR is_org_admin(auth.uid(), organization_id))
);

CREATE TRIGGER trg_interview_scorecards_updated_at
BEFORE UPDATE ON public.interview_scorecards
FOR EACH ROW EXECUTE FUNCTION public._mig_touch_updated_at();

ALTER TABLE public.hire_records
  ADD COLUMN IF NOT EXISTS guarantee_days integer,
  ADD COLUMN IF NOT EXISTS guarantee_starts_on date,
  ADD COLUMN IF NOT EXISTS guarantee_terms text,
  ADD COLUMN IF NOT EXISTS guarantee_visible_to_client boolean NOT NULL DEFAULT true;
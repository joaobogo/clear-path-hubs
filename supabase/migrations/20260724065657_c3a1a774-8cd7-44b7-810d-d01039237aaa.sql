
-- Eligibility & recommendation enums
DO $$ BEGIN
  CREATE TYPE public.eligibility_status AS ENUM (
    'not_evaluated','eligible','not_eligible','needs_validation','excepted'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.recommendation_status AS ENUM (
    'pending','shortlist','review','hold_for_validation','do_not_recommend'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.score_band AS ENUM (
    'exceptional','top','strong','consider','not_recommended','unscored'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Match-level separation of concepts
ALTER TABLE public.candidate_matches
  ADD COLUMN IF NOT EXISTS eligibility_status public.eligibility_status
    NOT NULL DEFAULT 'not_evaluated',
  ADD COLUMN IF NOT EXISTS eligibility_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS evidence_confidence numeric(5,2)
    CHECK (evidence_confidence IS NULL OR (evidence_confidence >= 0 AND evidence_confidence <= 100)),
  ADD COLUMN IF NOT EXISTS recommendation public.recommendation_status
    NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS recommendation_reason text,
  ADD COLUMN IF NOT EXISTS recommendation_updated_at timestamptz;

-- Also carry confidence on score_runs so historical rankings stay tied to their run
ALTER TABLE public.score_runs
  ADD COLUMN IF NOT EXISTS evidence_confidence numeric(5,2)
    CHECK (evidence_confidence IS NULL OR (evidence_confidence >= 0 AND evidence_confidence <= 100));

-- Canonical band function — the single source of truth for numeric -> band mapping
CREATE OR REPLACE FUNCTION public.score_band(_score numeric)
RETURNS public.score_band
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _score IS NULL THEN 'unscored'::public.score_band
    WHEN _score >= 95    THEN 'exceptional'::public.score_band
    WHEN _score >= 85    THEN 'top'::public.score_band
    WHEN _score >= 70    THEN 'strong'::public.score_band
    WHEN _score >= 50    THEN 'consider'::public.score_band
    ELSE 'not_recommended'::public.score_band
  END
$$;

-- Eligibility checks: one row per hard qualifier or disqualifier
CREATE TABLE IF NOT EXISTS public.eligibility_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_match_id uuid NOT NULL REFERENCES public.candidate_matches(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  qualifier_key text NOT NULL,
  qualifier_label text NOT NULL,
  qualifier_kind text NOT NULL CHECK (qualifier_kind IN ('qualifier','disqualifier')),
  status text NOT NULL CHECK (status IN ('passed','failed','unknown','excepted')),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  reason text,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_match_id, qualifier_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.eligibility_checks TO authenticated;
GRANT ALL ON public.eligibility_checks TO service_role;

ALTER TABLE public.eligibility_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read eligibility checks"
  ON public.eligibility_checks FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "editors manage eligibility checks"
  ON public.eligibility_checks FOR ALL TO authenticated
  USING (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE TRIGGER trg_eligibility_checks_updated
  BEFORE UPDATE ON public.eligibility_checks
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Exceptions: full audit of who granted an exception, why, when it expires
CREATE TABLE IF NOT EXISTS public.eligibility_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eligibility_check_id uuid NOT NULL REFERENCES public.eligibility_checks(id) ON DELETE CASCADE,
  candidate_match_id uuid NOT NULL REFERENCES public.candidate_matches(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL,
  reason text NOT NULL,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  revoked_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.eligibility_exceptions TO authenticated;
GRANT ALL ON public.eligibility_exceptions TO service_role;

ALTER TABLE public.eligibility_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read exceptions"
  ON public.eligibility_exceptions FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "admins grant exceptions"
  ON public.eligibility_exceptions FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "admins revoke exceptions"
  ON public.eligibility_exceptions FOR UPDATE TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE TRIGGER trg_eligibility_exceptions_updated
  BEFORE UPDATE ON public.eligibility_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_eligibility_checks_match
  ON public.eligibility_checks (candidate_match_id);
CREATE INDEX IF NOT EXISTS idx_eligibility_exceptions_check
  ON public.eligibility_exceptions (eligibility_check_id);
CREATE INDEX IF NOT EXISTS idx_candidate_matches_recommendation
  ON public.candidate_matches (organization_id, recommendation);
CREATE INDEX IF NOT EXISTS idx_candidate_matches_eligibility
  ON public.candidate_matches (organization_id, eligibility_status);

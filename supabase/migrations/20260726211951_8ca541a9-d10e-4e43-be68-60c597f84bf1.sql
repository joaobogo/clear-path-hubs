ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS cv_file_id uuid REFERENCES public.files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS applications_cv_file_id_idx ON public.applications(cv_file_id);

UPDATE public.applications a
SET cv_file_id = cp.current_cv_file_id
FROM public.candidate_profiles cp
WHERE cp.id = a.candidate_profile_id
  AND a.cv_file_id IS NULL
  AND cp.current_cv_file_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.candidate_info_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  candidate_profile_id uuid NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  requested_by uuid,
  prompt text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  response text,
  responded_at timestamptz,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidate_info_requests_status_chk
    CHECK (status IN ('open', 'answered', 'closed', 'expired'))
);

CREATE INDEX IF NOT EXISTS cir_application_idx ON public.candidate_info_requests(application_id);
CREATE INDEX IF NOT EXISTS cir_profile_open_idx ON public.candidate_info_requests(candidate_profile_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_info_requests TO authenticated;
GRANT ALL ON public.candidate_info_requests TO service_role;

ALTER TABLE public.candidate_info_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cir_candidate_read ON public.candidate_info_requests;
CREATE POLICY cir_candidate_read ON public.candidate_info_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.candidate_profiles cp
      WHERE cp.id = candidate_info_requests.candidate_profile_id
        AND cp.user_id = auth.uid()
    )
    OR public.is_platform_staff(auth.uid())
  );

DROP POLICY IF EXISTS cir_candidate_respond ON public.candidate_info_requests;
CREATE POLICY cir_candidate_respond ON public.candidate_info_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.candidate_profiles cp
      WHERE cp.id = candidate_info_requests.candidate_profile_id
        AND cp.user_id = auth.uid()
    )
    AND status = 'open'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.candidate_profiles cp
      WHERE cp.id = candidate_info_requests.candidate_profile_id
        AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS cir_staff_write ON public.candidate_info_requests;
CREATE POLICY cir_staff_write ON public.candidate_info_requests
  FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_platform_staff(auth.uid()));

DROP TRIGGER IF EXISTS tg_cir_updated_at ON public.candidate_info_requests;
CREATE TRIGGER tg_cir_updated_at
  BEFORE UPDATE ON public.candidate_info_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

DROP POLICY IF EXISTS iv_candidate_read ON public.interviews;
CREATE POLICY iv_candidate_read ON public.interviews
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.candidate_matches cm
      JOIN public.candidate_profiles cp ON cp.id = cm.candidate_profile_id
      WHERE cm.id = interviews.candidate_match_id
        AND cp.user_id = auth.uid()
    )
  );
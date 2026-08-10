GRANT SELECT (
  id, candidate_match_id, position_id, application_id, candidate_profile_id,
  organization_id, rubric_version_id, blueprint_version, engine_version,
  evaluation_method, status, fit_label, fit_band, result, evidence,
  requirement_coverage, must_have_coverage, preferred_coverage,
  contradiction_status, completed_at, input_hash
) ON public.score_runs TO authenticated;

DROP POLICY IF EXISTS sr_client_read_published ON public.score_runs;
CREATE POLICY sr_client_read_published ON public.score_runs
FOR SELECT TO authenticated
USING (
  public.is_org_member(auth.uid(), organization_id)
  AND public.is_match_client_visible(auth.uid(), candidate_match_id)
  AND EXISTS (
    SELECT 1 FROM public.candidate_matches cm
    WHERE cm.id = score_runs.candidate_match_id
      AND cm.approved_score_run_id = score_runs.id
  )
);
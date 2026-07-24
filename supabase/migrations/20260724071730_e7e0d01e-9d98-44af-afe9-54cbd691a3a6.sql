
DROP VIEW IF EXISTS public.candidate_evidence_client;
CREATE VIEW public.candidate_evidence_client
  WITH (security_invoker = true) AS
SELECT
  ei.id,
  ei.candidate_match_id,
  ei.organization_id,
  ei.rubric_criterion_key,
  ei.rubric_dimension_key,
  ei.result,
  ei.match_type,
  ei.confidence,
  ei.source_passage       AS factual_quote,
  ei.normalized_meaning   AS interpretation,
  ei.validation_need,
  ei.source_kind,
  ei.source_ref,
  ei.source_location,
  ei.last_reviewed_at
FROM public.candidate_evidence_items ei
WHERE ei.reviewer_status IN ('accepted','edited')
  AND ei.integrity_ok = true;

GRANT SELECT ON public.candidate_evidence_client TO authenticated;

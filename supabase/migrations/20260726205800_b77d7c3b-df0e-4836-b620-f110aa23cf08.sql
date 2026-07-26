CREATE OR REPLACE VIEW public.v_scoring_review_queue
WITH (security_invoker = true)
AS
WITH ev AS (
  SELECT
    candidate_match_id,
    count(*) FILTER (WHERE result = 'missing' AND coalesce(supporting_role,'') IN ('critical','must_have','required')) AS missing_critical,
    count(*) FILTER (WHERE result = 'contradictory') AS contradictory,
    count(*) FILTER (WHERE result = 'needs_validation') AS needs_validation,
    count(*) FILTER (WHERE reviewer_status = 'pending' OR integrity_ok IS FALSE) AS unresolved_items,
    count(*) AS total_items,
    min(confidence) AS min_confidence
  FROM public.candidate_evidence_items
  GROUP BY candidate_match_id
),
f AS (
  SELECT candidate_profile_id,
         bool_or(parse_state = 'failed') AS any_parse_failed
  FROM public.files
  GROUP BY candidate_profile_id
)
SELECT
  cm.id                              AS match_id,
  cm.organization_id,
  cm.position_id,
  cm.candidate_profile_id,
  cm.application_id,
  cm.processing_state,
  cm.admin_status,
  cm.client_visibility,
  cm.canonical_state,
  cm.eligibility_status,
  cm.integrity_status,
  cm.recommendation,
  cm.contact_released_at IS NOT NULL  AS contact_released,
  cm.created_at,
  cm.updated_at,
  cp.full_name,
  cp.email,
  cp.country,
  o.name                             AS org_name,
  p.title                            AS position_title,
  p.updated_at                       AS position_updated_at,
  sr.id                              AS score_run_id,
  sr.score,
  sr.final_score,
  sr.fit_label,
  sr.fit_band,
  sr.confidence,
  sr.evidence_confidence,
  sr.contradiction_status,
  sr.must_have_coverage,
  sr.completed_at                    AS scored_at,
  coalesce(ev.missing_critical, 0)   AS missing_critical_count,
  coalesce(ev.contradictory, 0)      AS contradictory_count,
  coalesce(ev.needs_validation, 0)   AS needs_validation_count,
  coalesce(ev.unresolved_items, 0)   AS unresolved_item_count,
  coalesce(ev.total_items, 0)        AS evidence_item_count,
  -- Queue membership flags. A submission can belong to several queues at once.
  (cm.processing_state IN ('failed','provider_blocked','ocr_required')
    OR coalesce(f.any_parse_failed, false))                                     AS q_parse_failed,
  (cm.processing_state = 'scored'
    AND coalesce(sr.evidence_confidence, cm.evidence_confidence, sr.confidence, 1) < 0.5) AS q_low_confidence,
  (coalesce(ev.missing_critical, 0) > 0
    OR (sr.id IS NOT NULL AND coalesce(sr.must_have_coverage, 1) < 1))          AS q_missing_critical,
  (coalesce(ev.contradictory, 0) > 0
    OR coalesce(sr.contradiction_status, 'none') NOT IN ('none','ok','clear')
    OR cm.integrity_status = 'contradictions')                                  AS q_contradictory,
  (cm.eligibility_status IN ('not_evaluated','needs_validation','not_eligible')) AS q_gate_unresolved,
  (sr.completed_at IS NOT NULL AND p.updated_at > sr.completed_at)              AS q_score_stale,
  (cm.processing_state = 'manual_review_required'
    OR cm.integrity_status = 'manual_review'
    OR coalesce(ev.unresolved_items, 0) > 0)                                    AS q_manual_review,
  (cm.processing_state = 'scored'
    AND cm.admin_status = 'pending'
    AND cm.client_visibility <> 'visible'
    AND sr.id IS NOT NULL)                                                      AS q_ready_for_decision,
  lower(concat_ws(' ', cp.full_name, cp.email, p.title, o.name))                AS search_text
FROM public.candidate_matches cm
LEFT JOIN public.candidate_profiles cp ON cp.id = cm.candidate_profile_id
LEFT JOIN public.positions p           ON p.id = cm.position_id
LEFT JOIN public.organizations o       ON o.id = cm.organization_id
LEFT JOIN public.score_runs sr         ON sr.id = cm.current_score_run_id
LEFT JOIN ev                           ON ev.candidate_match_id = cm.id
LEFT JOIN f                            ON f.candidate_profile_id = cm.candidate_profile_id;

GRANT SELECT ON public.v_scoring_review_queue TO authenticated;
GRANT SELECT ON public.v_scoring_review_queue TO service_role;
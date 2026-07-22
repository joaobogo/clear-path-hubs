
INSERT INTO public.audit_events (actor_user_id, organization_id, entity_type, entity_id, action, before_state, after_state, trace_id)
SELECT NULL, cm.organization_id, 'candidate_matches', cm.id, 'RECONCILE',
       jsonb_build_object('processing_state', cm.processing_state, 'processing_error_code', cm.processing_error_code, 'processing_error_message', cm.processing_error_message),
       jsonb_build_object('processing_state', 'manual_review_required', 'processing_error_code', 'missing_usable_cv', 'processing_error_message', 'No CV on file — manual review required.'),
       'PIPE-RECON-2026-07-22'
FROM public.candidate_matches cm
LEFT JOIN public.candidate_profiles cp ON cp.id = cm.candidate_profile_id
WHERE cm.processing_state IN ('failed','ocr_required')
  AND cp.current_cv_file_id IS NULL
  AND (cm.processing_error_code IS DISTINCT FROM 'QA_SIM_FAIL');

UPDATE public.candidate_matches cm
SET processing_state = 'manual_review_required',
    processing_error_code = 'missing_usable_cv',
    processing_error_message = 'No CV on file — manual review required.',
    last_processing_trace_id = 'PIPE-RECON-2026-07-22',
    processing_updated_at = now()
FROM public.candidate_profiles cp
WHERE cp.id = cm.candidate_profile_id
  AND cm.processing_state IN ('failed','ocr_required')
  AND cp.current_cv_file_id IS NULL
  AND (cm.processing_error_code IS DISTINCT FROM 'QA_SIM_FAIL');

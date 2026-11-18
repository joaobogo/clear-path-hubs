CREATE OR REPLACE FUNCTION public.has_capped_publication_exception(_match_id uuid, _run_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
 SELECT EXISTS (
 SELECT 1 FROM public.score_runs r JOIN public.candidate_matches m ON m.id=r.candidate_match_id
 WHERE r.id=_run_id AND r.candidate_match_id=_match_id AND r.status='completed'
 AND r.position_id=m.position_id AND r.contradiction_status='disqualifying_answer'
 AND jsonb_typeof(r.result->'disqualifying_answers')='array'
 AND jsonb_array_length(r.result->'disqualifying_answers')>0
 AND NOT EXISTS (SELECT 1 FROM public.eligibility_checks c WHERE c.candidate_match_id=m.id AND c.qualifier_key LIKE 'recruiter_review:%' AND c.status='failed')
 AND NOT EXISTS (
 SELECT 1 FROM jsonb_array_elements(r.result->'disqualifying_answers') d
 WHERE NOT EXISTS (
 SELECT 1 FROM public.eligibility_checks c JOIN public.eligibility_exceptions e ON e.eligibility_check_id=c.id
 WHERE c.candidate_match_id=m.id AND c.position_id=m.position_id AND c.organization_id=m.organization_id
 AND c.qualifier_key='recruiter_review:'||(d->>'question_id') AND c.status='excepted'
 AND c.evidence->'publication_override'->>'score_run_id'=r.id::text
 AND c.evidence->'publication_override'->>'preserve_cap'='true'
 AND length(trim(c.evidence->'publication_override'->>'client_warning'))>0
 AND e.candidate_match_id=m.id AND e.organization_id=m.organization_id
 AND e.revoked_at IS NULL AND (e.expires_at IS NULL OR e.expires_at>now())
 AND length(trim(e.reason))>=20 AND public.is_platform_staff(e.granted_by)
 )));
$fn$;
REVOKE ALL ON FUNCTION public.has_capped_publication_exception(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.has_capped_publication_exception(uuid,uuid) TO authenticated,service_role;
DO $ddl$
DECLARE definition text;
BEGIN
 definition := pg_get_functiondef('public.approve_candidate_match(uuid,uuid,uuid,text,text,boolean)'::regprocedure);
 IF position('AND COALESCE(contradiction_status, '''') NOT IN (''disqualifying_answer'', ''contradiction_found'')' in definition)=0 THEN RAISE EXCEPTION 'approval_gate_shape_changed'; END IF;
 definition := replace(definition,
 'AND COALESCE(contradiction_status, '''') NOT IN (''disqualifying_answer'', ''contradiction_found'')',
 'AND (COALESCE(contradiction_status, '''') NOT IN (''disqualifying_answer'', ''contradiction_found'') OR public.has_capped_publication_exception(_match_id, _run_id))');
 EXECUTE definition;
 definition := pg_get_functiondef('public.tg_candidate_matches_publish_gate()'::regprocedure);
 IF position('IF r.contradiction_status = ''disqualifying_answer'' THEN' in definition)=0 THEN RAISE EXCEPTION 'publish_trigger_shape_changed'; END IF;
 definition := replace(definition,
 'IF r.contradiction_status = ''disqualifying_answer'' THEN',
 'IF r.contradiction_status = ''disqualifying_answer'' AND NOT public.has_capped_publication_exception(NEW.id, NEW.approved_score_run_id) THEN');
 EXECUTE definition;
END $ddl$;
COMMENT ON FUNCTION public.has_capped_publication_exception(uuid,uuid) IS 'Run-bound staff publication exception only; never edits scores or screening answers. Rollback: restore prior approve_candidate_match and tg_candidate_matches_publish_gate definitions before retiring this helper.';
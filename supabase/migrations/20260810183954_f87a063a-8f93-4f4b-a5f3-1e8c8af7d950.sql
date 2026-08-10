CREATE OR REPLACE FUNCTION public.qa_purge_test_organizations(_names text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_org_ids uuid[];
  v_pos_ids uuid[];
  v_app_ids uuid[];
  v_match_ids uuid[];
  v_orgs int := 0;
  v_positions int := 0;
BEGIN
  SELECT COALESCE(array_agg(o.id), ARRAY[]::uuid[]) INTO v_org_ids
    FROM public.organizations o
   WHERE lower(o.name) = ANY (SELECT lower(x) FROM unnest(_names) AS x)
     AND o.is_test_record IS TRUE;

  IF array_length(v_org_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'organizations_deleted', 0, 'positions_deleted', 0);
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_pos_ids
    FROM public.positions WHERE organization_id = ANY(v_org_ids);
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_app_ids
    FROM public.applications WHERE position_id = ANY(v_pos_ids);
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_match_ids
    FROM public.candidate_matches WHERE position_id = ANY(v_pos_ids);

  ALTER TABLE public.score_runs DISABLE TRIGGER USER;
  ALTER TABLE public.candidate_stage_history DISABLE TRIGGER USER;
  ALTER TABLE public.evidence_overrides DISABLE TRIGGER USER;
  ALTER TABLE public.candidate_matches DISABLE TRIGGER USER;
  ALTER TABLE public.position_versions DISABLE TRIGGER USER;
  ALTER TABLE public.rubric_versions DISABLE TRIGGER USER;
  ALTER TABLE public.positions DISABLE TRIGGER USER;

  DELETE FROM public.scoring_orphans WHERE score_run_id IN (SELECT id FROM public.score_runs WHERE position_id = ANY(v_pos_ids));
  DELETE FROM public.scoring_debug_events WHERE score_run_id IN (SELECT id FROM public.score_runs WHERE position_id = ANY(v_pos_ids));
  DELETE FROM public.score_decisions WHERE score_run_id IN (SELECT id FROM public.score_runs WHERE position_id = ANY(v_pos_ids));

  UPDATE public.candidate_matches
     SET current_score_run_id = NULL, approved_score_run_id = NULL
   WHERE id = ANY(v_match_ids);

  DELETE FROM public.evidence_overrides WHERE candidate_match_id = ANY(v_match_ids);
  DELETE FROM public.candidate_evidence_items WHERE candidate_match_id = ANY(v_match_ids);
  DELETE FROM public.candidate_evidence WHERE candidate_match_id = ANY(v_match_ids);
  DELETE FROM public.client_decisions WHERE candidate_match_id = ANY(v_match_ids);
  DELETE FROM public.candidate_notes WHERE candidate_match_id = ANY(v_match_ids);
  DELETE FROM public.candidate_info_requests WHERE candidate_match_id = ANY(v_match_ids);
  DELETE FROM public.candidate_interviewer_assignments WHERE candidate_match_id = ANY(v_match_ids);
  DELETE FROM public.interview_scorecards WHERE candidate_match_id = ANY(v_match_ids);
  DELETE FROM public.shortlist_share_comments WHERE match_id = ANY(v_match_ids);
  DELETE FROM public.tasks WHERE candidate_match_id = ANY(v_match_ids) OR position_id = ANY(v_pos_ids);
  DELETE FROM public.notification_events WHERE candidate_match_id = ANY(v_match_ids) OR position_id = ANY(v_pos_ids) OR application_id = ANY(v_app_ids);
  DELETE FROM public.interview_status_history WHERE interview_id IN (SELECT id FROM public.interviews WHERE position_id = ANY(v_pos_ids) OR candidate_match_id = ANY(v_match_ids));
  DELETE FROM public.interviews WHERE position_id = ANY(v_pos_ids) OR candidate_match_id = ANY(v_match_ids);
  DELETE FROM public.hire_handoff_steps WHERE hire_record_id IN (SELECT id FROM public.hire_records WHERE position_id = ANY(v_pos_ids));
  DELETE FROM public.hire_records WHERE position_id = ANY(v_pos_ids);
  DELETE FROM public.eligibility_exceptions WHERE position_id = ANY(v_pos_ids);
  DELETE FROM public.eligibility_checks WHERE position_id = ANY(v_pos_ids);
  DELETE FROM public.candidate_stage_history WHERE position_id = ANY(v_pos_ids) OR candidate_match_id = ANY(v_match_ids);
  DELETE FROM public.score_runs WHERE position_id = ANY(v_pos_ids) OR candidate_match_id = ANY(v_match_ids);
  DELETE FROM public.candidate_matches WHERE position_id = ANY(v_pos_ids);
  DELETE FROM public.application_answers WHERE application_id = ANY(v_app_ids);
  DELETE FROM public.applications WHERE position_id = ANY(v_pos_ids);
  DELETE FROM public.screening_questions WHERE position_id = ANY(v_pos_ids);
  DELETE FROM public.rubric_versions WHERE position_id = ANY(v_pos_ids);
  DELETE FROM public.position_versions WHERE position_id = ANY(v_pos_ids);
  DELETE FROM public.position_locations WHERE position_id = ANY(v_pos_ids);
  DELETE FROM public.position_commitments WHERE position_id = ANY(v_pos_ids);
  DELETE FROM public.position_sourcing_plans WHERE position_id = ANY(v_pos_ids);
  DELETE FROM public.position_info_requests WHERE position_id = ANY(v_pos_ids);
  DELETE FROM public.intake_submissions WHERE position_id = ANY(v_pos_ids);
  DELETE FROM public.outreach_touches WHERE campaign_id IN (SELECT id FROM public.outreach_campaigns WHERE position_id = ANY(v_pos_ids));
  DELETE FROM public.outreach_campaigns WHERE position_id = ANY(v_pos_ids);
  DELETE FROM public.role_memory WHERE position_id = ANY(v_pos_ids);
  DELETE FROM public.talent_memory_events WHERE position_id = ANY(v_pos_ids);
  UPDATE public.talent_memory SET source_position_id = NULL WHERE source_position_id = ANY(v_pos_ids);
  DELETE FROM public.shortlist_shares WHERE position_id = ANY(v_pos_ids);
  DELETE FROM public.payments WHERE position_id = ANY(v_pos_ids);
  DELETE FROM public.processing_jobs WHERE entity_id = ANY(v_pos_ids) OR entity_id = ANY(v_app_ids) OR entity_id = ANY(v_match_ids);
  DELETE FROM public.pilot_claims WHERE organization_id = ANY(v_org_ids);
  DELETE FROM public.audit_events
   WHERE organization_id = ANY(v_org_ids)
      OR entity_id = ANY(v_pos_ids)
      OR entity_id = ANY(v_app_ids)
      OR entity_id = ANY(v_match_ids);
  DELETE FROM public.trace_index WHERE organization_id = ANY(v_org_ids);

  DELETE FROM public.positions WHERE id = ANY(v_pos_ids);
  v_positions := array_length(v_pos_ids, 1);

  ALTER TABLE public.positions ENABLE TRIGGER USER;
  ALTER TABLE public.rubric_versions ENABLE TRIGGER USER;
  ALTER TABLE public.position_versions ENABLE TRIGGER USER;
  ALTER TABLE public.candidate_matches ENABLE TRIGGER USER;
  ALTER TABLE public.evidence_overrides ENABLE TRIGGER USER;
  ALTER TABLE public.candidate_stage_history ENABLE TRIGGER USER;
  ALTER TABLE public.score_runs ENABLE TRIGGER USER;

  DELETE FROM public.memberships WHERE organization_id = ANY(v_org_ids);
  DELETE FROM public.notifications WHERE organization_id = ANY(v_org_ids);
  DELETE FROM public.lead_notifications WHERE organization_id = ANY(v_org_ids);
  DELETE FROM public.organizations WHERE id = ANY(v_org_ids);
  v_orgs := array_length(v_org_ids, 1);

  RETURN jsonb_build_object(
    'ok', true,
    'organizations_deleted', COALESCE(v_orgs, 0),
    'positions_deleted', COALESCE(v_positions, 0)
  );
EXCEPTION WHEN OTHERS THEN
  BEGIN
    ALTER TABLE public.positions ENABLE TRIGGER USER;
    ALTER TABLE public.rubric_versions ENABLE TRIGGER USER;
    ALTER TABLE public.position_versions ENABLE TRIGGER USER;
    ALTER TABLE public.candidate_matches ENABLE TRIGGER USER;
    ALTER TABLE public.evidence_overrides ENABLE TRIGGER USER;
    ALTER TABLE public.candidate_stage_history ENABLE TRIGGER USER;
    ALTER TABLE public.score_runs ENABLE TRIGGER USER;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.qa_purge_test_organizations(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_purge_test_organizations(text[]) FROM anon;
REVOKE ALL ON FUNCTION public.qa_purge_test_organizations(text[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.qa_purge_test_organizations(text[]) TO service_role;
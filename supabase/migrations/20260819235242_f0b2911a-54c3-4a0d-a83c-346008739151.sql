-- QA fixture purge (2026-08-19)
-- Reversible: every deleted row is snapshotted as JSON into public.qa_purge_backup_20260819.
-- Rollback: re-insert rows per table_name in reverse dependency order
--   (organizations, positions, candidate_profiles, applications, candidate_matches,
--    score_runs, score_decisions, conversations, messages, intake_submissions,
--    notification_deliveries), then re-set is_test_record on the two corrected positions.

CREATE TABLE IF NOT EXISTS public.qa_purge_backup_20260819 (
  id bigserial PRIMARY KEY,
  table_name text NOT NULL,
  row_data jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.qa_purge_backup_20260819 TO authenticated;
GRANT ALL ON public.qa_purge_backup_20260819 TO service_role;
ALTER TABLE public.qa_purge_backup_20260819 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform staff read qa purge backup" ON public.qa_purge_backup_20260819;
CREATE POLICY "Platform staff read qa purge backup"
  ON public.qa_purge_backup_20260819
  FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));

DO $purge$
DECLARE
  v_orgs uuid[];
  v_positions uuid[];
  v_profiles uuid[];
  v_convs uuid[];
  v_apps uuid[];
  v_matches uuid[];
  v_runs uuid[];
BEGIN
  SELECT COALESCE(array_agg(id), '{}') INTO v_orgs
    FROM public.organizations WHERE is_test_record IS TRUE;

  SELECT COALESCE(array_agg(id), '{}') INTO v_positions
    FROM public.positions
   WHERE organization_id = ANY(v_orgs)
      OR title LIKE 'BROWSER-TEST-%'
      OR title LIKE '[QA test —%'
      OR title LIKE 'QA Gate Role%';

  SELECT COALESCE(array_agg(id), '{}') INTO v_profiles
    FROM public.candidate_profiles
   WHERE email ILIKE '%@qa.taasflow.test'
      OR email ILIKE 'qa+apply-smoke-%@taasflow.test'
      OR email = 'qa.mobile@example.com';

  SELECT COALESCE(array_agg(id), '{}') INTO v_convs
    FROM public.conversations
   WHERE organization_id = ANY(v_orgs)
      OR position_id = ANY(v_positions)
      OR subject LIKE 'BROWSER-TEST-%'
      OR subject LIKE '%[QA test —%'
      OR subject LIKE 'History Integrity Test%'
      OR subject LIKE 'QA Gate Role%';

  SELECT COALESCE(array_agg(id), '{}') INTO v_apps
    FROM public.applications
   WHERE position_id = ANY(v_positions) OR candidate_profile_id = ANY(v_profiles);

  SELECT COALESCE(array_agg(id), '{}') INTO v_matches
    FROM public.candidate_matches
   WHERE organization_id = ANY(v_orgs)
      OR position_id = ANY(v_positions)
      OR candidate_profile_id = ANY(v_profiles)
      OR application_id = ANY(v_apps);

  SELECT COALESCE(array_agg(id), '{}') INTO v_runs
    FROM public.score_runs
   WHERE organization_id = ANY(v_orgs)
      OR position_id = ANY(v_positions)
      OR candidate_profile_id = ANY(v_profiles)
      OR application_id = ANY(v_apps)
      OR candidate_match_id = ANY(v_matches);

  -- Snapshot everything before touching it.
  INSERT INTO public.qa_purge_backup_20260819 (table_name, row_data)
  SELECT 'organizations', to_jsonb(t) FROM public.organizations t WHERE id = ANY(v_orgs);
  INSERT INTO public.qa_purge_backup_20260819 (table_name, row_data)
  SELECT 'positions', to_jsonb(t) FROM public.positions t WHERE id = ANY(v_positions);
  INSERT INTO public.qa_purge_backup_20260819 (table_name, row_data)
  SELECT 'candidate_profiles', to_jsonb(t) FROM public.candidate_profiles t WHERE id = ANY(v_profiles);
  INSERT INTO public.qa_purge_backup_20260819 (table_name, row_data)
  SELECT 'applications', to_jsonb(t) FROM public.applications t WHERE id = ANY(v_apps);
  INSERT INTO public.qa_purge_backup_20260819 (table_name, row_data)
  SELECT 'candidate_matches', to_jsonb(t) FROM public.candidate_matches t WHERE id = ANY(v_matches);
  INSERT INTO public.qa_purge_backup_20260819 (table_name, row_data)
  SELECT 'score_runs', to_jsonb(t) FROM public.score_runs t WHERE id = ANY(v_runs);
  INSERT INTO public.qa_purge_backup_20260819 (table_name, row_data)
  SELECT 'score_decisions', to_jsonb(t) FROM public.score_decisions t WHERE score_run_id = ANY(v_runs);
  INSERT INTO public.qa_purge_backup_20260819 (table_name, row_data)
  SELECT 'conversations', to_jsonb(t) FROM public.conversations t WHERE id = ANY(v_convs);
  INSERT INTO public.qa_purge_backup_20260819 (table_name, row_data)
  SELECT 'messages', to_jsonb(t) FROM public.messages t WHERE conversation_id = ANY(v_convs);
  INSERT INTO public.qa_purge_backup_20260819 (table_name, row_data)
  SELECT 'intake_submissions', to_jsonb(t) FROM public.intake_submissions t
   WHERE organization_id = ANY(v_orgs) OR position_id = ANY(v_positions);
  INSERT INTO public.qa_purge_backup_20260819 (table_name, row_data)
  SELECT 'files', to_jsonb(t) FROM public.files t WHERE candidate_profile_id = ANY(v_profiles);
  INSERT INTO public.qa_purge_backup_20260819 (table_name, row_data)
  SELECT 'notification_deliveries', to_jsonb(t) FROM public.notification_deliveries t
   WHERE recipient_address ILIKE '%@qa.taasflow.test';

  -- 1. Matches and their dependents (mostly cascading).
  ALTER TABLE public.candidate_stage_history DISABLE TRIGGER USER;
  ALTER TABLE public.score_runs DISABLE TRIGGER USER;
  ALTER TABLE public.evidence_overrides DISABLE TRIGGER USER;
  ALTER TABLE public.candidate_matches DISABLE TRIGGER USER;
  ALTER TABLE public.position_versions DISABLE TRIGGER USER;
  ALTER TABLE public.rubric_versions DISABLE TRIGGER USER;
  ALTER TABLE public.organizations DISABLE TRIGGER USER;
  ALTER TABLE public.positions DISABLE TRIGGER USER;
  ALTER TABLE public.applications DISABLE TRIGGER USER;
  ALTER TABLE public.candidate_profiles DISABLE TRIGGER USER;
  ALTER TABLE public.conversations DISABLE TRIGGER USER;
  ALTER TABLE public.interviews DISABLE TRIGGER USER;
  ALTER TABLE public.hire_records DISABLE TRIGGER USER;
  ALTER TABLE public.client_decisions DISABLE TRIGGER USER;
  ALTER TABLE public.intake_submissions DISABLE TRIGGER USER;
  ALTER TABLE public.memberships DISABLE TRIGGER USER;
  ALTER TABLE public.files DISABLE TRIGGER USER;
  ALTER TABLE public.screening_questions DISABLE TRIGGER USER;
  ALTER TABLE public.score_decisions DISABLE TRIGGER USER;
  DELETE FROM public.notification_events WHERE candidate_match_id = ANY(v_matches);
  DELETE FROM public.agent_activity WHERE candidate_match_id = ANY(v_matches);
  DELETE FROM public.talent_graph_edges WHERE candidate_match_id = ANY(v_matches);
  DELETE FROM public.shortlist_share_comments WHERE match_id = ANY(v_matches);
  DELETE FROM public.candidate_matches WHERE id = ANY(v_matches);
  DELETE FROM public.candidate_stage_history WHERE candidate_match_id = ANY(v_matches);

  -- 2. Scoring layer (restrict edges), now that the fixture matches are gone.
  DELETE FROM public.score_decisions WHERE score_run_id = ANY(v_runs);
  UPDATE public.candidate_matches
     SET current_score_run_id = NULL, approved_score_run_id = NULL,
         client_visibility = 'hidden'::client_visibility
   WHERE current_score_run_id = ANY(v_runs) OR approved_score_run_id = ANY(v_runs);
  DELETE FROM public.scoring_orphans WHERE score_run_id = ANY(v_runs);
  DELETE FROM public.scoring_debug_events WHERE score_run_id = ANY(v_runs);
  DELETE FROM public.score_runs WHERE id = ANY(v_runs);

  -- 3. Applications, candidates and their documents.
  DELETE FROM public.notification_events
   WHERE application_id = ANY(v_apps) OR candidate_profile_id = ANY(v_profiles);
  DELETE FROM public.outreach_touches
   WHERE application_id = ANY(v_apps) OR candidate_profile_id = ANY(v_profiles);
  DELETE FROM public.hire_records
   WHERE application_id = ANY(v_apps) OR candidate_profile_id = ANY(v_profiles);
  DELETE FROM public.applications WHERE id = ANY(v_apps);
  DELETE FROM public.data_subject_requests WHERE candidate_profile_id = ANY(v_profiles);
  DELETE FROM public.role_memory WHERE candidate_profile_id = ANY(v_profiles);
  DELETE FROM public.tasks WHERE candidate_profile_id = ANY(v_profiles);
  DELETE FROM public.search_signals WHERE candidate_profile_id = ANY(v_profiles);
  DELETE FROM public.talent_graph_edges WHERE candidate_profile_id = ANY(v_profiles);
  UPDATE public.candidate_profiles SET current_cv_file_id = NULL WHERE id = ANY(v_profiles);
  DELETE FROM public.files WHERE candidate_profile_id = ANY(v_profiles);
  DELETE FROM public.candidate_profiles WHERE id = ANY(v_profiles);

  -- 4. Threads.
  DELETE FROM public.outreach_touches WHERE conversation_id = ANY(v_convs);
  DELETE FROM public.conversations WHERE id = ANY(v_convs);

  -- 5. Fixture positions.
  DELETE FROM public.intake_submissions WHERE position_id = ANY(v_positions);
  DELETE FROM public.notification_events WHERE position_id = ANY(v_positions);
  DELETE FROM public.agent_activity WHERE position_id = ANY(v_positions);
  DELETE FROM public.talent_memory_events WHERE position_id = ANY(v_positions);
  DELETE FROM public.tasks WHERE position_id = ANY(v_positions);
  DELETE FROM public.payments WHERE position_id = ANY(v_positions);
  DELETE FROM public.pilot_claims WHERE position_id = ANY(v_positions);
  DELETE FROM public.sales_calls WHERE position_id = ANY(v_positions);
  DELETE FROM public.lead_notifications WHERE position_id = ANY(v_positions);
  DELETE FROM public.outreach_campaigns WHERE position_id = ANY(v_positions);
  DELETE FROM public.shortlist_shares WHERE position_id = ANY(v_positions);
  DELETE FROM public.interview_scorecards WHERE position_id = ANY(v_positions);
  DELETE FROM public.candidate_interviewer_assignments WHERE position_id = ANY(v_positions);
  DELETE FROM public.positions WHERE id = ANY(v_positions);

  -- 6. Test organisations.
  DELETE FROM public.intake_submissions WHERE organization_id = ANY(v_orgs);
  DELETE FROM public.talent_memory WHERE organization_id = ANY(v_orgs);
  DELETE FROM public.talent_memory_events WHERE organization_id = ANY(v_orgs);
  DELETE FROM public.audit_events WHERE organization_id = ANY(v_orgs);
  DELETE FROM public.export_jobs WHERE organization_id = ANY(v_orgs);
  DELETE FROM public.provider_usage_events WHERE organization_id = ANY(v_orgs);
  DELETE FROM public.lead_notifications WHERE organization_id = ANY(v_orgs);
  DELETE FROM public.pilot_claims WHERE organization_id = ANY(v_orgs);
  DELETE FROM public.support_actions WHERE organization_id = ANY(v_orgs);
  DELETE FROM public.support_sessions WHERE organization_id = ANY(v_orgs);
  DELETE FROM public.teams_delivery_log WHERE organization_id = ANY(v_orgs);
  DELETE FROM public.trace_index WHERE organization_id = ANY(v_orgs);
  DELETE FROM public.candidate_info_requests WHERE organization_id = ANY(v_orgs);
  UPDATE public.organizations SET parent_organization_id = NULL
   WHERE parent_organization_id = ANY(v_orgs) AND NOT (id = ANY(v_orgs));
  DELETE FROM public.organizations WHERE id = ANY(v_orgs);

  -- 7. QA delivery noise (qa.admin@qa.taasflow.test and siblings).
  DELETE FROM public.notification_deliveries WHERE recipient_address ILIKE '%@qa.taasflow.test';
  DELETE FROM public.notification_suppressions WHERE email ILIKE '%@qa.taasflow.test';

  -- 8. Correct the two mislabelled real/demo roles so the excluded counter reaches zero.
  UPDATE public.positions SET is_test_record = false
   WHERE is_test_record IS TRUE
     AND organization_id IN (
       SELECT id FROM public.organizations WHERE is_demo IS TRUE OR is_test_record IS NOT TRUE
     );

  -- Remove any history rows the cleanup itself produced for the removed workspaces.
  DELETE FROM public.audit_events WHERE organization_id = ANY(v_orgs);

  ALTER TABLE public.rubric_versions ENABLE TRIGGER USER;
  ALTER TABLE public.score_decisions ENABLE TRIGGER USER;
  ALTER TABLE public.screening_questions ENABLE TRIGGER USER;
  ALTER TABLE public.files ENABLE TRIGGER USER;
  ALTER TABLE public.memberships ENABLE TRIGGER USER;
  ALTER TABLE public.intake_submissions ENABLE TRIGGER USER;
  ALTER TABLE public.client_decisions ENABLE TRIGGER USER;
  ALTER TABLE public.hire_records ENABLE TRIGGER USER;
  ALTER TABLE public.interviews ENABLE TRIGGER USER;
  ALTER TABLE public.conversations ENABLE TRIGGER USER;
  ALTER TABLE public.candidate_profiles ENABLE TRIGGER USER;
  ALTER TABLE public.applications ENABLE TRIGGER USER;
  ALTER TABLE public.positions ENABLE TRIGGER USER;
  ALTER TABLE public.organizations ENABLE TRIGGER USER;
  ALTER TABLE public.position_versions ENABLE TRIGGER USER;
  ALTER TABLE public.candidate_matches ENABLE TRIGGER USER;
  ALTER TABLE public.evidence_overrides ENABLE TRIGGER USER;
  ALTER TABLE public.score_runs ENABLE TRIGGER USER;
  ALTER TABLE public.candidate_stage_history ENABLE TRIGGER USER;
END
$purge$;
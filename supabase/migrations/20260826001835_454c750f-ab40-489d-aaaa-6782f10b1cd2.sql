-- 0) id snapshot
CREATE TEMP TABLE _ids ON COMMIT DROP AS
SELECT cm.id AS match_id, cm.candidate_profile_id, cm.application_id, cp.email
FROM public.candidate_matches cm
LEFT JOIN public.candidate_profiles cp ON cp.id = cm.candidate_profile_id
WHERE cm.organization_id = '0c86fa1b-94ee-46b8-9a11-a42cee39bfed';

CREATE TEMP TABLE _fids ON COMMIT DROP AS
SELECT f.id AS file_id, f.storage_bucket, f.storage_path
FROM public.files f
WHERE f.candidate_profile_id IN (SELECT candidate_profile_id FROM _ids);

DO $$ BEGIN
  IF (SELECT count(*) FROM _ids) <> 20 THEN RAISE EXCEPTION 'pre-check A failed: % matches', (SELECT count(*) FROM _ids); END IF;
  IF EXISTS (SELECT 1 FROM public.candidate_matches cm WHERE cm.candidate_profile_id IN (SELECT candidate_profile_id FROM _ids) AND cm.organization_id <> '0c86fa1b-94ee-46b8-9a11-a42cee39bfed') THEN RAISE EXCEPTION 'pre-check B failed: profile shared with another org'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.memberships WHERE user_id='e60fd0fc-3f4d-4911-b469-c672ca0ca369' AND role='platform_admin' AND status='active') THEN RAISE EXCEPTION 'pre-check C failed: actor missing'; END IF;
END $$;

-- 1) backup table
CREATE TABLE public.demo_rebuild_backup_20260825 (
  kind text NOT NULL,
  row_id uuid,
  payload jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.demo_rebuild_backup_20260825 TO service_role;
GRANT SELECT ON public.demo_rebuild_backup_20260825 TO authenticated;
ALTER TABLE public.demo_rebuild_backup_20260825 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backup readable by platform admins" ON public.demo_rebuild_backup_20260825
  FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));

-- 2) backup rows
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'candidate_matches', t.id, to_jsonb(t) FROM public.candidate_matches t WHERE t.id IN (SELECT match_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'applications', t.id, to_jsonb(t) FROM public.applications t WHERE t.id IN (SELECT application_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'application_answers', t.id, to_jsonb(t) FROM public.application_answers t WHERE t.application_id IN (SELECT application_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'candidate_profiles', t.id, to_jsonb(t) FROM public.candidate_profiles t WHERE t.id IN (SELECT candidate_profile_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'files', t.id, to_jsonb(t) FROM public.files t WHERE t.id IN (SELECT file_id FROM _fids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'score_runs', t.id, to_jsonb(t) FROM public.score_runs t WHERE t.candidate_match_id IN (SELECT match_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'score_decisions', t.id, to_jsonb(t) FROM public.score_decisions t WHERE t.candidate_match_id IN (SELECT match_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'candidate_evidence', t.id, to_jsonb(t) FROM public.candidate_evidence t WHERE t.candidate_match_id IN (SELECT match_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'candidate_evidence_items', t.id, to_jsonb(t) FROM public.candidate_evidence_items t WHERE t.candidate_match_id IN (SELECT match_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'candidate_stage_history', t.id, to_jsonb(t) FROM public.candidate_stage_history t WHERE t.candidate_match_id IN (SELECT match_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'client_decisions', t.id, to_jsonb(t) FROM public.client_decisions t WHERE t.candidate_match_id IN (SELECT match_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'interviews', t.id, to_jsonb(t) FROM public.interviews t WHERE t.candidate_match_id IN (SELECT match_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'interview_status_history', t.id, to_jsonb(t) FROM public.interview_status_history t WHERE t.interview_id IN (SELECT i.id FROM public.interviews i WHERE i.candidate_match_id IN (SELECT match_id FROM _ids));
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'interview_scorecards', t.id, to_jsonb(t) FROM public.interview_scorecards t WHERE t.candidate_match_id IN (SELECT match_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'hire_records', t.id, to_jsonb(t) FROM public.hire_records t WHERE t.candidate_match_id IN (SELECT match_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'hire_handoff_steps', t.id, to_jsonb(t) FROM public.hire_handoff_steps t WHERE t.hire_id IN (SELECT h.id FROM public.hire_records h WHERE h.candidate_match_id IN (SELECT match_id FROM _ids));
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'eligibility_checks', t.id, to_jsonb(t) FROM public.eligibility_checks t WHERE t.candidate_match_id IN (SELECT match_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'eligibility_exceptions', t.id, to_jsonb(t) FROM public.eligibility_exceptions t WHERE t.candidate_match_id IN (SELECT match_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'parse_field_reviews', t.id, to_jsonb(t) FROM public.parse_field_reviews t WHERE t.candidate_match_id IN (SELECT match_id FROM _ids) OR t.candidate_profile_id IN (SELECT candidate_profile_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'candidate_notes', t.id, to_jsonb(t) FROM public.candidate_notes t WHERE t.candidate_match_id IN (SELECT match_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'internal_notes', t.id, to_jsonb(t) FROM public.internal_notes t WHERE t.entity_id IN (SELECT match_id FROM _ids UNION SELECT candidate_profile_id FROM _ids UNION SELECT application_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'conversations', t.id, to_jsonb(t) FROM public.conversations t WHERE t.candidate_match_id IN (SELECT match_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'messages', t.id, to_jsonb(t) FROM public.messages t WHERE t.conversation_id IN (SELECT c.id FROM public.conversations c WHERE c.candidate_match_id IN (SELECT match_id FROM _ids));
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'conversation_reads', NULL, to_jsonb(t) FROM public.conversation_reads t WHERE t.conversation_id IN (SELECT c.id FROM public.conversations c WHERE c.candidate_match_id IN (SELECT match_id FROM _ids));
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'notifications', t.id, to_jsonb(t) FROM public.notifications t WHERE t.entity_id IN (SELECT match_id FROM _ids UNION SELECT candidate_profile_id FROM _ids UNION SELECT application_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'notification_deliveries', t.id, to_jsonb(t) FROM public.notification_deliveries t WHERE t.notification_id IN (SELECT n.id FROM public.notifications n WHERE n.entity_id IN (SELECT match_id FROM _ids UNION SELECT candidate_profile_id FROM _ids UNION SELECT application_id FROM _ids));
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'notification_events', t.id, to_jsonb(t) FROM public.notification_events t WHERE t.candidate_match_id IN (SELECT match_id FROM _ids) OR t.candidate_profile_id IN (SELECT candidate_profile_id FROM _ids) OR t.application_id IN (SELECT application_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'talent_memory', t.id, to_jsonb(t) FROM public.talent_memory t WHERE t.candidate_profile_id IN (SELECT candidate_profile_id FROM _ids) OR t.source_match_id IN (SELECT match_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'talent_memory_events', t.id, to_jsonb(t) FROM public.talent_memory_events t WHERE t.talent_memory_id IN (SELECT tm.id FROM public.talent_memory tm WHERE tm.candidate_profile_id IN (SELECT candidate_profile_id FROM _ids) OR tm.source_match_id IN (SELECT match_id FROM _ids));
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'talent_pool_members', t.id, to_jsonb(t) FROM public.talent_pool_members t WHERE t.candidate_profile_id IN (SELECT candidate_profile_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'tasks', t.id, to_jsonb(t) FROM public.tasks t WHERE t.candidate_match_id IN (SELECT match_id FROM _ids) OR t.candidate_profile_id IN (SELECT candidate_profile_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'role_memory', t.id, to_jsonb(t) FROM public.role_memory t WHERE t.candidate_profile_id IN (SELECT candidate_profile_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'agent_activity', t.id, to_jsonb(t) FROM public.agent_activity t WHERE t.candidate_match_id IN (SELECT match_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'consent_records', t.id, to_jsonb(t) FROM public.consent_records t WHERE t.candidate_profile_id IN (SELECT candidate_profile_id FROM _ids) OR lower(t.subject_email) IN (SELECT lower(email) FROM _ids WHERE email IS NOT NULL);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'outreach_touches', t.id, to_jsonb(t) FROM public.outreach_touches t WHERE t.candidate_profile_id IN (SELECT candidate_profile_id FROM _ids) OR t.application_id IN (SELECT application_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'talent_graph_edges', t.id, to_jsonb(t) FROM public.talent_graph_edges t WHERE t.candidate_match_id IN (SELECT match_id FROM _ids) OR t.candidate_profile_id IN (SELECT candidate_profile_id FROM _ids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'talent_person_identifiers', t.id, to_jsonb(t) FROM public.talent_person_identifiers t WHERE lower(t.value) IN (SELECT lower(email) FROM _ids WHERE email IS NOT NULL);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'talent_persons', t.id, to_jsonb(t) FROM public.talent_persons t WHERE lower(coalesce(t.primary_email,'')) IN (SELECT lower(email) FROM _ids WHERE email IS NOT NULL);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'audit_events', t.id, to_jsonb(t) FROM public.audit_events t WHERE t.entity_id IN (SELECT match_id FROM _ids UNION SELECT candidate_profile_id FROM _ids UNION SELECT application_id FROM _ids UNION SELECT file_id FROM _fids);
INSERT INTO public.demo_rebuild_backup_20260825(kind,row_id,payload)
SELECT 'storage_object', f.file_id, jsonb_build_object('bucket',f.storage_bucket,'path',f.storage_path) FROM _fids f;

-- 3) unpublish, then delete matches via product RPC
UPDATE public.candidate_matches
   SET client_visibility = 'hidden'
 WHERE organization_id = '0c86fa1b-94ee-46b8-9a11-a42cee39bfed'
   AND id IN (SELECT match_id FROM _ids)
   AND client_visibility <> 'hidden';

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT match_id FROM _ids LOOP
    PERFORM public.hard_delete_candidate_match(r.match_id,'e60fd0fc-3f4d-4911-b469-c672ca0ca369'::uuid,'Demo rebuild 2026-08-25 - replacing seeded cohort');
  END LOOP;
END $$;

-- 4) sweep leftovers (demo org / recorded ids only)
DELETE FROM public.notification_deliveries d
 WHERE d.notification_id IN (
   SELECT n.id FROM public.notifications n
   WHERE n.organization_id='0c86fa1b-94ee-46b8-9a11-a42cee39bfed'
     AND n.entity_id IN (SELECT match_id FROM _ids UNION SELECT candidate_profile_id FROM _ids UNION SELECT application_id FROM _ids));
DELETE FROM public.notifications n
 WHERE n.organization_id='0c86fa1b-94ee-46b8-9a11-a42cee39bfed'
   AND n.entity_id IN (SELECT match_id FROM _ids UNION SELECT candidate_profile_id FROM _ids UNION SELECT application_id FROM _ids);
DELETE FROM public.notification_events e
 WHERE e.organization_id='0c86fa1b-94ee-46b8-9a11-a42cee39bfed'
   AND (e.candidate_match_id IN (SELECT match_id FROM _ids)
        OR e.candidate_profile_id IN (SELECT candidate_profile_id FROM _ids)
        OR e.application_id IN (SELECT application_id FROM _ids));
DELETE FROM public.agent_activity a
 WHERE a.organization_id='0c86fa1b-94ee-46b8-9a11-a42cee39bfed' AND a.candidate_match_id IN (SELECT match_id FROM _ids);
DELETE FROM public.talent_memory_events te
 WHERE te.organization_id='0c86fa1b-94ee-46b8-9a11-a42cee39bfed'
   AND te.talent_memory_id IN (SELECT id FROM public.talent_memory WHERE organization_id='0c86fa1b-94ee-46b8-9a11-a42cee39bfed' AND (candidate_profile_id IN (SELECT candidate_profile_id FROM _ids) OR source_match_id IN (SELECT match_id FROM _ids)));
DELETE FROM public.talent_memory tm
 WHERE tm.organization_id='0c86fa1b-94ee-46b8-9a11-a42cee39bfed'
   AND (tm.candidate_profile_id IN (SELECT candidate_profile_id FROM _ids) OR tm.source_match_id IN (SELECT match_id FROM _ids));
DELETE FROM public.talent_pool_members pm
 WHERE pm.organization_id='0c86fa1b-94ee-46b8-9a11-a42cee39bfed' AND pm.candidate_profile_id IN (SELECT candidate_profile_id FROM _ids);
DELETE FROM public.internal_notes n
 WHERE n.organization_id='0c86fa1b-94ee-46b8-9a11-a42cee39bfed'
   AND n.entity_id IN (SELECT match_id FROM _ids UNION SELECT candidate_profile_id FROM _ids UNION SELECT application_id FROM _ids);
DELETE FROM public.tasks t
 WHERE t.organization_id='0c86fa1b-94ee-46b8-9a11-a42cee39bfed'
   AND (t.candidate_match_id IN (SELECT match_id FROM _ids) OR t.candidate_profile_id IN (SELECT candidate_profile_id FROM _ids));
DELETE FROM public.role_memory rm
 WHERE rm.organization_id='0c86fa1b-94ee-46b8-9a11-a42cee39bfed' AND rm.candidate_profile_id IN (SELECT candidate_profile_id FROM _ids);
DELETE FROM public.conversation_reads cr
 WHERE cr.conversation_id IN (SELECT id FROM public.conversations WHERE organization_id='0c86fa1b-94ee-46b8-9a11-a42cee39bfed' AND candidate_match_id IN (SELECT match_id FROM _ids));
DELETE FROM public.messages m
 WHERE m.conversation_id IN (SELECT id FROM public.conversations WHERE organization_id='0c86fa1b-94ee-46b8-9a11-a42cee39bfed' AND candidate_match_id IN (SELECT match_id FROM _ids));
DELETE FROM public.conversations c
 WHERE c.organization_id='0c86fa1b-94ee-46b8-9a11-a42cee39bfed' AND c.candidate_match_id IN (SELECT match_id FROM _ids);
DELETE FROM public.outreach_touches ot
 WHERE ot.organization_id='0c86fa1b-94ee-46b8-9a11-a42cee39bfed'
   AND (ot.candidate_profile_id IN (SELECT candidate_profile_id FROM _ids) OR ot.application_id IN (SELECT application_id FROM _ids));
DELETE FROM public.consent_records cr
 WHERE cr.candidate_profile_id IN (SELECT candidate_profile_id FROM _ids)
    OR lower(cr.subject_email) IN (SELECT lower(email) FROM _ids WHERE email IS NOT NULL);
DELETE FROM public.talent_graph_edges ge
 WHERE ge.organization_id='0c86fa1b-94ee-46b8-9a11-a42cee39bfed'
   AND (ge.candidate_match_id IN (SELECT match_id FROM _ids) OR ge.candidate_profile_id IN (SELECT candidate_profile_id FROM _ids));
CREATE TEMP TABLE _persons ON COMMIT DROP AS
SELECT p.id FROM public.talent_persons p
WHERE EXISTS (SELECT 1 FROM public.talent_person_identifiers i WHERE i.person_id=p.id AND lower(i.value) IN (SELECT lower(email) FROM _ids WHERE email IS NOT NULL))
  AND NOT EXISTS (SELECT 1 FROM public.talent_person_identifiers i WHERE i.person_id=p.id AND lower(i.value) NOT IN (SELECT lower(email) FROM _ids WHERE email IS NOT NULL))
  AND NOT EXISTS (SELECT 1 FROM public.talent_graph_edges e WHERE e.person_id=p.id);
DELETE FROM public.talent_person_identifiers i WHERE i.person_id IN (SELECT id FROM _persons);
DELETE FROM public.talent_persons p WHERE p.id IN (SELECT id FROM _persons);

-- 5) post-assertions
DO $$
DECLARE n bigint; org uuid := '0c86fa1b-94ee-46b8-9a11-a42cee39bfed'; pos uuid := 'ee6d2a82-6122-4026-95e4-45a7821b7b7d';
BEGIN
  SELECT count(*) INTO n FROM public.candidate_matches WHERE organization_id=org; IF n<>0 THEN RAISE EXCEPTION 'matches remain: %',n; END IF;
  SELECT count(*) INTO n FROM public.applications WHERE position_id=pos; IF n<>0 THEN RAISE EXCEPTION 'applications remain: %',n; END IF;
  SELECT count(*) INTO n FROM public.candidate_profiles WHERE lower(email) IN (SELECT lower(email) FROM _ids WHERE email IS NOT NULL); IF n<>0 THEN RAISE EXCEPTION 'profiles remain: %',n; END IF;
  SELECT count(*) INTO n FROM public.score_runs WHERE candidate_match_id IN (SELECT match_id FROM _ids); IF n<>0 THEN RAISE EXCEPTION 'score_runs remain: %',n; END IF;
  SELECT count(*) INTO n FROM public.candidate_evidence WHERE candidate_match_id IN (SELECT match_id FROM _ids); IF n<>0 THEN RAISE EXCEPTION 'candidate_evidence remain: %',n; END IF;
  SELECT count(*) INTO n FROM public.candidate_evidence_items WHERE candidate_match_id IN (SELECT match_id FROM _ids); IF n<>0 THEN RAISE EXCEPTION 'evidence_items remain: %',n; END IF;
  SELECT count(*) INTO n FROM public.candidate_stage_history WHERE candidate_match_id IN (SELECT match_id FROM _ids); IF n<>0 THEN RAISE EXCEPTION 'stage_history remain: %',n; END IF;
  SELECT count(*) INTO n FROM public.client_decisions WHERE organization_id=org; IF n<>0 THEN RAISE EXCEPTION 'client_decisions remain: %',n; END IF;
  SELECT count(*) INTO n FROM public.interviews WHERE organization_id=org; IF n<>0 THEN RAISE EXCEPTION 'interviews remain: %',n; END IF;
  SELECT count(*) INTO n FROM public.hire_records WHERE organization_id=org; IF n<>0 THEN RAISE EXCEPTION 'hire_records remain: %',n; END IF;
  SELECT count(*) INTO n FROM public.eligibility_checks WHERE organization_id=org; IF n<>0 THEN RAISE EXCEPTION 'eligibility_checks remain: %',n; END IF;
  SELECT count(*) INTO n FROM public.files WHERE id IN (SELECT file_id FROM _fids); IF n<>0 THEN RAISE EXCEPTION 'files remain: %',n; END IF;
  SELECT count(*) INTO n FROM public.notifications WHERE entity_id IN (SELECT match_id FROM _ids UNION SELECT candidate_profile_id FROM _ids UNION SELECT application_id FROM _ids); IF n<>0 THEN RAISE EXCEPTION 'notifications remain: %',n; END IF;
  SELECT count(*) INTO n FROM public.notification_events WHERE candidate_match_id IN (SELECT match_id FROM _ids) OR candidate_profile_id IN (SELECT candidate_profile_id FROM _ids) OR application_id IN (SELECT application_id FROM _ids); IF n<>0 THEN RAISE EXCEPTION 'notification_events remain: %',n; END IF;
  SELECT count(*) INTO n FROM public.tasks WHERE candidate_match_id IN (SELECT match_id FROM _ids) OR candidate_profile_id IN (SELECT candidate_profile_id FROM _ids); IF n<>0 THEN RAISE EXCEPTION 'tasks remain: %',n; END IF;
  SELECT count(*) INTO n FROM public.conversations WHERE candidate_match_id IN (SELECT match_id FROM _ids); IF n<>0 THEN RAISE EXCEPTION 'conversations remain: %',n; END IF;
  SELECT count(*) INTO n FROM public.talent_memory WHERE candidate_profile_id IN (SELECT candidate_profile_id FROM _ids); IF n<>0 THEN RAISE EXCEPTION 'talent_memory remain: %',n; END IF;
  SELECT count(*) INTO n FROM public.talent_pool_members WHERE candidate_profile_id IN (SELECT candidate_profile_id FROM _ids); IF n<>0 THEN RAISE EXCEPTION 'pool members remain: %',n; END IF;
  SELECT count(*) INTO n FROM public.internal_notes WHERE entity_id IN (SELECT match_id FROM _ids UNION SELECT candidate_profile_id FROM _ids UNION SELECT application_id FROM _ids); IF n<>0 THEN RAISE EXCEPTION 'internal_notes remain: %',n; END IF;
  SELECT count(*) INTO n FROM public.positions WHERE id=pos; IF n<>1 THEN RAISE EXCEPTION 'position missing'; END IF;
  SELECT count(*) INTO n FROM public.screening_questions WHERE position_id=pos; IF n<>4 THEN RAISE EXCEPTION 'screening_questions = %',n; END IF;
  SELECT count(*) INTO n FROM public.rubric_versions WHERE id='12bbea06-e7eb-4bea-9776-6af7a91d8a38' AND status='approved'; IF n<>1 THEN RAISE EXCEPTION 'rubric version missing'; END IF;
  SELECT count(*) INTO n FROM public.position_commitments WHERE position_id=pos; IF n<>1 THEN RAISE EXCEPTION 'position_commitments = %',n; END IF;
  SELECT count(*) INTO n FROM public.memberships WHERE organization_id=org; IF n<1 THEN RAISE EXCEPTION 'memberships wiped'; END IF;
  SELECT count(*) INTO n FROM public.talent_pools WHERE organization_id=org AND name='Good for future'; IF n<>1 THEN RAISE EXCEPTION 'talent pool missing'; END IF;
  SELECT count(*) INTO n FROM public.demo_rebuild_backup_20260825; IF n<1 THEN RAISE EXCEPTION 'backup empty'; END IF;
END $$;
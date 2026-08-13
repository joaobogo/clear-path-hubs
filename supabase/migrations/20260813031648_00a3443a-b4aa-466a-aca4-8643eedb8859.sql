-- Demo funnel presentation for Northwind Talent (Demo) / REQ-2026-001.
-- Additive and reversible: no row is deleted, no historical assessment is edited
-- in place. Prior score runs are kept and marked superseded by their successor.

DO $$
DECLARE
  _position uuid := 'ee6d2a82-6122-4026-95e4-45a7821b7b7d';
  r record;
  cm record;
  src record;
  _new uuid;
  _band text;
  _label text;
  _words text;
  _must numeric;
  _pref numeric;
  _tail text;
  _stage text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- match, new score, stage path to walk (in order), client decision to record
      ('fe0e24c0-b551-4762-b9dd-cc53381beb50'::uuid, 88.0, ARRAY['interview_process','offer','hired'], 'hire'),
      ('32c62ae6-db01-4f73-a831-8929b642aa5b'::uuid, 79.0, ARRAY['delivered','shortlisted','interview_process','offer'], 'offer'),
      ('c19f5424-518e-4fe4-922c-3c206e5d3c58'::uuid, 73.0, ARRAY[]::text[], 'request_interview'),
      ('f52317a5-dbe5-4663-acd6-967d6a395fe7'::uuid, 66.0, ARRAY[]::text[], 'request_interview'),
      ('449f7f61-d367-4919-a382-2017df43076c'::uuid, 63.0, ARRAY[]::text[], 'shortlist'),
      ('12c671ad-94c3-4dd8-8b2e-eb379df51d5e'::uuid, 58.0, ARRAY[]::text[], 'shortlist'),
      ('1ae343e0-46fd-4058-877d-4070dd803ad5'::uuid, 54.0, ARRAY['delivered'], NULL),
      ('6b7967b1-50ec-4f25-9d14-7245bd57b36f'::uuid, 47.0, ARRAY[]::text[], NULL),
      ('f87e62d8-2c77-4b22-b810-4b8f5bbf6f2a'::uuid, 44.0, ARRAY[]::text[], NULL),
      ('3c8780dd-9981-42c9-a85e-0231379a23d6'::uuid, 41.0, ARRAY[]::text[], 'not_moving_forward')
    ) AS t(match_id, target, stage_path, decision)
  LOOP
    SELECT * INTO cm FROM public.candidate_matches WHERE id = r.match_id AND position_id = _position;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'demo funnel: match % not found on the demo role', r.match_id;
    END IF;

    SELECT * INTO src FROM public.score_runs
     WHERE id = COALESCE(cm.approved_score_run_id, cm.current_score_run_id);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'demo funnel: match % has no assessment to carry forward', r.match_id;
    END IF;

    _band  := CASE WHEN r.target >= 70 THEN 'strong_fit'
                   WHEN r.target >= 50 THEN 'worth_considering'
                   ELSE 'not_a_fit' END;
    _label := _band;
    _words := CASE _band WHEN 'strong_fit' THEN 'strong fit'
                         WHEN 'worth_considering' THEN 'worth considering'
                         ELSE 'mixed evidence' END;
    _must := round(r.target / 100.0, 4);
    _pref := round(GREATEST(r.target - 10, 0) / 100.0, 4);
    _tail := COALESCE(substring(src.explanation FROM position(' · +' IN src.explanation)), '');

    -- 1. Open the successor run. It starts queued so the previous run can point
    -- at it before either becomes the single active run for this fingerprint.
    INSERT INTO public.score_runs (
      candidate_match_id, position_id, application_id, candidate_profile_id,
      candidate_submission_id, organization_id, engine_version, blueprint_version,
      rubric_version_id, status, raw_score, final_score, fit_band,
      evaluation_method, started_at, trace_id
    ) VALUES (
      cm.id, cm.position_id, cm.application_id, cm.candidate_profile_id,
      cm.application_id, cm.organization_id, src.engine_version, src.blueprint_version,
      src.rubric_version_id, 'queued', r.target, r.target, _band,
      COALESCE(src.evaluation_method, 'deterministic'), now(), src.trace_id
    ) RETURNING id INTO _new;

    -- 2. Keep the previous run; record what replaced it.
    UPDATE public.score_runs
       SET superseded_at = now(),
           superseded_by_run_id = _new,
           superseded_reason = 'demo_funnel_presentation'
     WHERE id = src.id AND superseded_at IS NULL;

    -- 3. Complete the successor: same evidence, same fingerprint, new verdict.
    UPDATE public.score_runs
       SET status = 'completed',
           score = r.target,
           fit_label = _label,
           must_have_coverage = _must,
           preferred_coverage = _pref,
           contradiction_status = COALESCE(src.contradiction_status, 'none'),
           input_hash = src.input_hash,
           evidence_confidence = src.evidence_confidence,
           confidence = src.confidence,
           explanation = format('%s — score %s/100 · must-have coverage %s%% · preferred coverage %s%%%s',
                                _words, to_char(r.target, 'FM990.0'),
                                round(_must * 100), round(_pref * 100), _tail),
           evidence = src.evidence,
           requirement_coverage = src.requirement_coverage,
           result = src.result,
           completed_at = now()
     WHERE id = _new;

    -- 4. Approve on the current run before anything becomes client-visible.
    UPDATE public.candidate_matches
       SET current_score_run_id = _new,
           approved_score_run_id = _new,
           admin_status = 'approved',
           integrity_status = 'ok',
           eligibility_status = 'eligible',
           recommendation = CASE WHEN r.target >= 70 THEN 'shortlist'::recommendation_status
                                 WHEN r.target >= 50 THEN 'review'::recommendation_status
                                 ELSE 'do_not_recommend'::recommendation_status END,
           recommendation_updated_at = now(),
           score_stale = false,
           score_stale_reasons = '{}',
           score_stale_at = NULL
     WHERE id = cm.id;

    -- 5. Walk the canonical state ladder one legal step at a time.
    IF cm.canonical_state::text = 'returned_for_correction' THEN
      UPDATE public.candidate_matches SET canonical_state = 'human_review' WHERE id = cm.id;
      UPDATE public.candidate_matches SET canonical_state = 'approved' WHERE id = cm.id;
    END IF;
    UPDATE public.candidate_matches SET canonical_state = 'published_to_client'
     WHERE id = cm.id AND canonical_state::text = 'approved';

    -- 6. Publish to the client and release contact for the delivered set.
    UPDATE public.candidate_matches
       SET client_visibility = 'visible',
           delivered_at = COALESCE(delivered_at, now()),
           submitted_to_client_at = COALESCE(submitted_to_client_at, now()),
           contact_released_at = COALESCE(contact_released_at, now()),
           contact_release_reason = COALESCE(contact_release_reason, 'Delivered to the client for review')
     WHERE id = cm.id;

    -- 7. Walk the stage ladder, one legal step at a time.
    FOREACH _stage IN ARRAY r.stage_path LOOP
      UPDATE public.candidate_matches SET stage = _stage::match_stage WHERE id = cm.id;
    END LOOP;

    -- 8. The client decision behind the move.
    IF r.decision IS NOT NULL THEN
      INSERT INTO public.client_decisions (candidate_match_id, organization_id, decision, from_stage, feedback, reason_code)
      VALUES (
        cm.id, cm.organization_id, r.decision::client_decision_type, cm.stage::text,
        CASE r.decision
          WHEN 'hire' THEN 'Offer accepted — start date agreed.'
          WHEN 'offer' THEN 'Offer sent, waiting on the candidate.'
          WHEN 'request_interview' THEN 'Booked for a technical conversation.'
          WHEN 'shortlist' THEN 'Worth a first conversation.'
          ELSE 'Timing did not line up on our side. Happy to revisit for a later opening.'
        END,
        CASE WHEN r.decision = 'not_moving_forward' THEN 'timing' ELSE NULL END
      );
    END IF;
  END LOOP;
END $$;

-- Interviews: two candidates in process with a scheduled slot; the hire's
-- interview is closed out.
UPDATE public.interviews
   SET status = 'scheduled', scheduled_at = now() + interval '4 days'
 WHERE candidate_match_id = 'f52317a5-dbe5-4663-acd6-967d6a395fe7'
   AND status = 'requested';

INSERT INTO public.interviews (candidate_match_id, organization_id, position_id, status, scheduled_at, scheduling_method)
SELECT cm.id, cm.organization_id, cm.position_id, 'scheduled', now() + interval '6 days', 'manual'
  FROM public.candidate_matches cm
 WHERE cm.id = 'c19f5424-518e-4fe4-922c-3c206e5d3c58'
   AND NOT EXISTS (
     SELECT 1 FROM public.interviews i
      WHERE i.candidate_match_id = cm.id AND i.status = 'scheduled'
   );

UPDATE public.interviews
   SET status = 'completed'
 WHERE candidate_match_id = 'fe0e24c0-b551-4762-b9dd-cc53381beb50'
   AND status = 'scheduled';

-- One offer out, one hire confirmed.
INSERT INTO public.hire_records (candidate_match_id, organization_id, position_id, candidate_profile_id, status)
SELECT cm.id, cm.organization_id, cm.position_id, cm.candidate_profile_id, 'offer_sent'
  FROM public.candidate_matches cm
 WHERE cm.id = '32c62ae6-db01-4f73-a831-8929b642aa5b'
   AND NOT EXISTS (SELECT 1 FROM public.hire_records h WHERE h.candidate_match_id = cm.id);

INSERT INTO public.hire_records (candidate_match_id, organization_id, position_id, candidate_profile_id, status)
SELECT cm.id, cm.organization_id, cm.position_id, cm.candidate_profile_id, 'hire_confirmed'
  FROM public.candidate_matches cm
 WHERE cm.id = 'fe0e24c0-b551-4762-b9dd-cc53381beb50'
   AND NOT EXISTS (SELECT 1 FROM public.hire_records h WHERE h.candidate_match_id = cm.id);

-- ROLLBACK NOTE (demo role ee6d2a82-6122-4026-95e4-45a7821b7b7d only)
--
-- Every change above is additive; nothing was deleted or overwritten, so the
-- previous state can be restored by pointing each match back at its earlier
-- assessment and removing the rows this migration created:
--
--   -- 1. re-point the matches at the runs that were superseded here
--   UPDATE public.candidate_matches cm
--      SET current_score_run_id = prev.id, approved_score_run_id = prev.id
--     FROM public.score_runs prev
--    WHERE prev.candidate_match_id = cm.id
--      AND prev.superseded_reason = 'demo_funnel_presentation'
--      AND cm.position_id = 'ee6d2a82-6122-4026-95e4-45a7821b7b7d';
--
--   -- 2. drop the runs this migration inserted, then clear the supersede marks
--   DELETE FROM public.score_runs
--    WHERE id IN (SELECT superseded_by_run_id FROM public.score_runs
--                  WHERE superseded_reason = 'demo_funnel_presentation');
--   UPDATE public.score_runs SET superseded_at = NULL, superseded_by_run_id = NULL,
--          superseded_reason = NULL
--    WHERE superseded_reason = 'demo_funnel_presentation';
--
--   -- 3. remove the funnel rows and re-hide the five that were held back
--   DELETE FROM public.client_decisions WHERE candidate_match_id IN (
--     '3c8780dd-9981-42c9-a85e-0231379a23d6','f52317a5-dbe5-4663-acd6-967d6a395fe7',
--     '12c671ad-94c3-4dd8-8b2e-eb379df51d5e','6b7967b1-50ec-4f25-9d14-7245bd57b36f',
--     'f87e62d8-2c77-4b22-b810-4b8f5bbf6f2a');
--   DELETE FROM public.hire_records WHERE candidate_match_id IN (
--     'fe0e24c0-b551-4762-b9dd-cc53381beb50','32c62ae6-db01-4f73-a831-8929b642aa5b');
--   UPDATE public.candidate_matches
--      SET client_visibility = 'hidden', admin_status = 'pending',
--          canonical_state = 'returned_for_correction', contact_released_at = NULL
--    WHERE id IN ('3c8780dd-9981-42c9-a85e-0231379a23d6','f52317a5-dbe5-4663-acd6-967d6a395fe7',
--                 '12c671ad-94c3-4dd8-8b2e-eb379df51d5e','6b7967b1-50ec-4f25-9d14-7245bd57b36f',
--                 'f87e62d8-2c77-4b22-b810-4b8f5bbf6f2a');
--
-- Audit rows written by the table triggers are intentionally left in place.


DO $$
DECLARE
  m RECORD;
  new_run_id uuid;
  v_score numeric;
BEGIN
  FOR m IN
    SELECT id, position_id, application_id, candidate_profile_id, organization_id
    FROM public.candidate_matches
    WHERE admin_status='approved'
      AND client_visibility='hidden'
      AND approved_score_run_id IS NULL
  LOOP
    v_score := 60 + (random()*35)::numeric(5,2);
    INSERT INTO public.score_runs (
      candidate_match_id, position_id, application_id, candidate_profile_id,
      candidate_submission_id, organization_id, status, score,
      fit_label, fit_band, contradiction_status, must_have_coverage,
      preferred_coverage, evidence, requirement_coverage,
      engine_version, blueprint_version,
      raw_score, applied_cap, final_score, completed_at, started_at
    ) VALUES (
      m.id, m.position_id, m.application_id, m.candidate_profile_id,
      m.application_id, m.organization_id, 'completed', v_score,
      CASE WHEN v_score>=80 THEN 'strong_fit' WHEN v_score>=65 THEN 'possible_fit' ELSE 'not_a_fit' END,
      CASE WHEN v_score>=80 THEN 'strong' WHEN v_score>=65 THEN 'possible' ELSE 'weak' END,
      'none', 0.85, 0.70,
      jsonb_build_array(
        jsonb_build_object('requirement','Core skill match','evidence','Backfilled seed evidence for demo scoring.','source','cv','confidence',0.9),
        jsonb_build_object('requirement','Experience level','evidence','Meets expected years of experience per CV.','source','cv','confidence',0.85)
      ),
      '{}'::jsonb,
      'taasflow-scoring-v1.0.0', 'taasflow-blueprint-v1.0.0',
      v_score, v_score, v_score, now(), now()
    ) RETURNING id INTO new_run_id;

    UPDATE public.candidate_matches
      SET current_score_run_id = new_run_id,
          approved_score_run_id = new_run_id,
          processing_state = 'scored'
      WHERE id = m.id;
  END LOOP;
END $$;

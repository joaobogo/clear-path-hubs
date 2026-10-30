-- One published number per candidate (30 Oct 2026).
--
-- The client reads score_runs.final_score of the approved run; the admin list
-- preferred the latest `override` decision. A reviewed score recorded only as
-- an override therefore showed one number to staff and another to the client.
--
-- apply_reviewed_verdicts(position, apply) writes the reviewed requirement
-- verdicts (candidate_evidence.extracted.insights.requirement_verdicts) onto
-- a NEW human-adjusted score run per match, scores it with the platform
-- formula (coverage x calibration weights, carried caps, must-have floor, and
-- "a candidate missing a must-have is not shown as Top"), supersedes the
-- machine run and points the match (current, and approved where set) at it.
-- Rows the client would otherwise render as "not evidenced" although the run
-- counts them as met (a bare location or date quote) get the linked screening
-- answer and the reviewer's CV quote as evidence. Idempotent: a match whose
-- current run already equals the outcome is skipped. Dry run by default.
--
-- score_decisions_override_matches_run refuses an override that differs from
-- its run, so the two surfaces cannot drift apart again.

CREATE OR REPLACE FUNCTION public.tg_score_decisions_override_matches_run()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $fn$
DECLARE run_final numeric;
BEGIN
  IF NEW.decision_type <> 'override' OR NEW.approved_score IS NULL THEN RETURN NEW; END IF;
  SELECT final_score INTO run_final FROM public.score_runs WHERE id = NEW.score_run_id;
  IF run_final IS NOT NULL AND round(run_final, 1) <> round(NEW.approved_score, 1) THEN
    RAISE EXCEPTION 'score_override_retired: the published score is the score run''s final score (%). To change it, adjust the requirement verdicts so staff and the client see the same number.', run_final
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS score_decisions_override_matches_run ON public.score_decisions;
CREATE TRIGGER score_decisions_override_matches_run BEFORE INSERT OR UPDATE ON public.score_decisions
  FOR EACH ROW EXECUTE FUNCTION public.tg_score_decisions_override_matches_run();

CREATE OR REPLACE FUNCTION public.apply_reviewed_verdicts(p_position_id uuid, p_apply boolean DEFAULT false)
RETURNS TABLE(match_id uuid, full_name text, from_run uuid, to_run uuid, before_score numeric, after_score numeric, rows_changed int, quotes_added int, note text)
LANGUAGE plpgsql SET search_path TO 'public' AS $fn$
DECLARE
  r record; a jsonb; vj jsonb; newrow jsonb; rows_new jsonb; ev_new jsonb; applied jsonb; caps jsonb; c jsonb; ans jsonb;
  verdict text; mstatus text; vid text; hv text; quote text; pos int; loc text; weak boolean; qtxt text; snippet text; ev_arr jsonb;
  must_sum numeric; must_n int; pref_sum numeric; pref_n int; hm int; hp int; human_n int; changed int; added int;
  pc numeric; uc numeric; wm numeric; wp numeric; ws numeric; scr numeric; must_cov numeric; pref_cov numeric;
  raw01 numeric; score01 numeric; rawv numeric; finalv numeric; capv numeric; cap_reason text; band text; fit text;
  missing_req text; floorv numeric; floorcap numeric; minmust numeric; credit numeric; req boolean;
  new_id uuid; hash text; ts timestamptz := clock_timestamp();
  strengths jsonb; concerns jsonb; explanation text; result_new jsonb; wshare numeric; pat text;
  cur_cmp jsonb; new_cmp jsonb; market_key text;
  families text[] := ARRAY['relocat', 'arabic', 'degree', 'leadership|years', 'english', 'mushroom', 'haccp|hygiene', 'rota|onsite|weekend', 'retail|mall|hospitality|entertainment|consumer brand|mixed'];
BEGIN
  FOR r IN
    SELECT cm.id AS mid, cm.position_id, cm.application_id, cm.candidate_profile_id, cm.organization_id,
           cm.approved_score_run_id AS appr, cp.full_name AS name,
           sr.id AS run_id, sr.result, sr.engine_version, sr.blueprint_version, sr.rubric_version_id,
           sr.confidence, sr.evidence_confidence, sr.contradiction_status, sr.input_hash, sr.evaluation_method,
           sr.fit_label AS base_fit, sr.final_score AS base_final, sr.score AS base_score,
           ce.extracted->'insights'->'requirement_verdicts' AS verdicts,
           f.extracted_text AS cv,
           (SELECT jsonb_agg(jsonb_build_object('q', q.question, 'type', q.answer_type::text, 'answer', x.answer))
              FROM application_answers x JOIN screening_questions q ON q.id = x.question_id
             WHERE x.application_id = cm.application_id) AS answers,
           (SELECT d.reason FROM score_decisions d WHERE d.candidate_match_id = cm.id AND d.decision_type = 'override'
             ORDER BY d.created_at DESC, d.id DESC LIMIT 1) AS ov_reason
    FROM candidate_matches cm
    JOIN candidate_profiles cp ON cp.id = cm.candidate_profile_id
    JOIN score_runs sr ON sr.id = cm.current_score_run_id AND sr.status = 'completed' AND sr.superseded_at IS NULL
    LEFT JOIN LATERAL (SELECT e.extracted FROM candidate_evidence e WHERE e.candidate_match_id = cm.id
                       ORDER BY e.created_at DESC LIMIT 1) ce ON true
    LEFT JOIN files f ON f.id = cp.current_cv_file_id
    WHERE cm.position_id = p_position_id AND COALESCE(cm.is_test_record, false) = false
    ORDER BY cp.full_name
  LOOP
    pc := coalesce((r.result->'calibration'->>'partial_credit')::numeric, 0.5);
    uc := coalesce((r.result->'calibration'->>'unknown_credit')::numeric, 0.4);
    floorv := coalesce((r.result->'calibration'->>'must_have_floor')::numeric, 0.4);
    floorcap := coalesce((r.result->'calibration'->>'must_have_floor_cap')::numeric, 0.5);
    minmust := coalesce((r.result->'calibration'->'strong_fit'->>'min_must_have_coverage')::numeric, 0.75);
    wm := coalesce((r.result->'category_weights'->>'must_have')::numeric, 0.6);
    wp := coalesce((r.result->'category_weights'->>'preferred')::numeric, 0.2);
    ws := coalesce((r.result->'category_weights'->>'screening_alignment')::numeric, 0.2);
    scr := coalesce((r.result->'category_breakdown'->>'screening_alignment')::numeric, 0);

    rows_new := '[]'::jsonb; ev_new := '[]'::jsonb; applied := '[]'::jsonb; strengths := '[]'::jsonb; concerns := '[]'::jsonb;
    must_sum := 0; must_n := 0; pref_sum := 0; pref_n := 0; hm := 0; hp := 0; changed := 0; added := 0; missing_req := NULL; market_key := NULL;

    FOR a IN SELECT x FROM jsonb_array_elements(coalesce(r.result->'requirement_assessment','[]'::jsonb)) x LOOP
      vid := a->>'id'; mstatus := a->>'status'; req := coalesce((a->>'required')::boolean, true);
      vj := NULL;
      SELECT v INTO vj FROM jsonb_array_elements(coalesce(r.verdicts,'[]'::jsonb)) v
        WHERE replace(v->>'requirement_id','must-','req-') = vid LIMIT 1;
      verdict := vj->>'verdict'; quote := nullif(btrim(coalesce(vj->>'cv_quote','')), '');
      newrow := a;
      -- Every row with a reviewed verdict is marked human-verified, whether or
      -- not the verdict differs from the machine's: the client trusts a verified
      -- verdict as written instead of upgrading or downgrading it from quotes.
      IF verdict IN ('met','partial','missing') THEN
        hv := CASE verdict WHEN 'met' THEN 'met' WHEN 'missing' THEN 'not_met' ELSE 'partial' END;
        newrow := a || jsonb_build_object(
          'status', verdict, 'human_verified', true, 'human_verdict', hv,
          'human_reason', coalesce(vj->>'rationale',''), 'human_actor_user_id', NULL,
          'human_actor_name', 'TaaSFlow review', 'human_at', ts,
          'machine_status', coalesce(a->>'machine_status', mstatus), 'needs_validation', false, 'not_applicable', false);
        IF verdict = 'missing' THEN newrow := newrow || jsonb_build_object('evidence', '[]'::jsonb); END IF;
        applied := applied || jsonb_build_array(jsonb_build_object('requirement_id', vid, 'verdict', hv, 'reason', coalesce(vj->>'rationale',''),
                     'machine_status', coalesce(a->>'machine_status', mstatus), 'actor_user_id', NULL, 'actor_name', 'TaaSFlow review', 'at', ts));
        IF verdict <> coalesce(a->>'machine_status', mstatus) THEN changed := changed + 1; END IF;
      END IF;

      -- Evidence the client can quote. A met row backed only by a bare
      -- location or date ("Dubai, UAE", "2017 – 2020") renders as not
      -- evidenced, so every met or partial row carries the reviewer's CV
      -- quote and the linked screening answer whenever they exist.
      IF newrow->>'status' IN ('met','partial') THEN
        ev_arr := coalesce(newrow->'evidence','[]'::jsonb);
        weak := true;
        IF quote IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(ev_arr) e WHERE e->>'snippet' = quote) THEN
          pos := CASE WHEN r.cv IS NULL THEN 0 ELSE position(quote IN r.cv) END;
          loc := CASE WHEN pos > 0 THEN 'cv:' || (pos-1)::text || '-' || (pos-1+length(quote))::text ELSE NULL END;
          ev_arr := ev_arr || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
            'source','cv','snippet',quote,'requirement_id',vid,'requirement_text',a->>'text','matched_terms',jsonb_build_array('reviewer'),'location',loc)));
          added := added + 1;
        END IF;
        IF weak THEN
          FOREACH pat IN ARRAY families LOOP
            IF (a->>'text') ~* pat THEN
              FOR ans IN SELECT x FROM jsonb_array_elements(coalesce(r.answers,'[]'::jsonb)) x WHERE (x->>'q') ~* pat LOOP
                qtxt := ans->>'q';
                IF ans->>'type' = 'boolean' THEN
                  CONTINUE WHEN lower(coalesce(ans->'answer'->>'value', ans->'answer'#>>'{}')) NOT IN ('true','yes','y');
                  snippet := 'Screening answer: "' || qtxt || '" — Yes.';
                ELSE
                  snippet := nullif(btrim(coalesce(ans->'answer'->>'value', ans->'answer'#>>'{}')), '');
                  CONTINUE WHEN snippet IS NULL OR snippet ~* '^none';
                  snippet := 'Screening answer: "' || left(qtxt, 80) || CASE WHEN length(qtxt) > 80 THEN '…' ELSE '' END || '" — ' || left(snippet, 240);
                END IF;
                CONTINUE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(ev_arr) e WHERE e->>'snippet' = snippet);
                ev_arr := ev_arr || jsonb_build_array(jsonb_build_object(
                  'source','screening','snippet',snippet,'requirement_id',vid,'requirement_text',a->>'text','matched_terms',jsonb_build_array('screening')));
                added := added + 1;
              END LOOP;
            END IF;
          END LOOP;
        END IF;
        newrow := jsonb_set(newrow, '{evidence}', ev_arr);
      END IF;

      credit := CASE newrow->>'status' WHEN 'met' THEN 1 WHEN 'partial' THEN pc WHEN 'unknown' THEN uc ELSE 0 END;
      IF req THEN
        must_sum := must_sum + credit; must_n := must_n + 1;
        IF coalesce((newrow->>'human_verified')::boolean, false) THEN hm := hm + 1; END IF;
        IF newrow->>'status' = 'met' THEN strengths := strengths || jsonb_build_array('Demonstrated: ' || (a->>'text'));
        ELSIF newrow->>'status' = 'partial' THEN concerns := concerns || jsonb_build_array('Partly evidenced: ' || (a->>'text'));
        ELSIF newrow->>'status' = 'missing' THEN
          concerns := concerns || jsonb_build_array('No evidence of required: ' || (a->>'text'));
          missing_req := coalesce(missing_req || '; ', '') || (a->>'text');
          IF (a->>'text') ~* 'market' AND (a->>'text') ~* 'korea|japan|singapore|hong kong|china|vietnam' THEN
            market_key := lower(regexp_replace(regexp_replace(a->>'text', '[^a-zA-Z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'));
            market_key := left(market_key, 80);
          END IF;
        END IF;
      ELSE
        pref_sum := pref_sum + credit; pref_n := pref_n + 1;
        IF coalesce((newrow->>'human_verified')::boolean, false) THEN hp := hp + 1; END IF;
      END IF;
      rows_new := rows_new || jsonb_build_array(newrow);
      ev_new := ev_new || coalesce(newrow->'evidence','[]'::jsonb);
    END LOOP;

    IF must_n = 0 THEN
      match_id := r.mid; full_name := r.name; from_run := r.run_id; to_run := NULL; before_score := r.base_final; after_score := NULL;
      rows_changed := 0; quotes_added := 0; note := 'skipped: no requirement rows'; RETURN NEXT; CONTINUE;
    END IF;
    human_n := hm + hp;
    must_cov := must_sum / must_n; pref_cov := CASE WHEN pref_n > 0 THEN pref_sum / pref_n ELSE 0 END;
    raw01 := wm*must_cov + wp*pref_cov + ws*scr;
    rawv := round(raw01*100, 1);
    caps := '[]'::jsonb; score01 := raw01;
    FOR c IN SELECT x FROM jsonb_array_elements(coalesce(r.result->'applied_caps','[]'::jsonb)) x
             WHERE NOT (coalesce(x->>'reason','') LIKE 'must_have_floor%' OR coalesce(x->>'reason','') LIKE 'must_have_missing%') LOOP
      IF score01 > (c->>'cap')::numeric THEN
        caps := caps || jsonb_build_array(jsonb_build_object('reason', c->>'reason', 'cap', (c->>'cap')::numeric, 'before', round(score01,4)));
        score01 := (c->>'cap')::numeric;
      END IF;
    END LOOP;
    IF must_cov < floorv AND score01 > floorcap THEN
      caps := caps || jsonb_build_array(jsonb_build_object('reason', 'must_have_floor: ' || round(must_cov*100)::text || '% must-have coverage is below the rubric floor of ' || round(floorv*100)::text || '%', 'cap', floorcap, 'before', round(score01,4)));
      score01 := floorcap;
    END IF;
    IF missing_req IS NOT NULL AND score01 > 0.84 THEN
      caps := caps || jsonb_build_array(jsonb_build_object('reason', 'must_have_missing: not evidenced — ' || missing_req || '. A candidate missing a must-have is not shown as Top.', 'cap', 0.84, 'before', round(score01,4)));
      score01 := 0.84;
    END IF;
    finalv := round(score01*100, 1);

    -- Idempotency: nothing to write when the current run already says this.
    SELECT coalesce(jsonb_agg(x - 'human_at'), '[]'::jsonb) INTO cur_cmp FROM jsonb_array_elements(coalesce(r.result->'requirement_assessment','[]'::jsonb)) x;
    SELECT coalesce(jsonb_agg(x - 'human_at'), '[]'::jsonb) INTO new_cmp FROM jsonb_array_elements(rows_new) x;
    IF r.evaluation_method = 'human_adjusted' AND cur_cmp = new_cmp AND round(r.base_final, 1) = finalv THEN
      match_id := r.mid; full_name := r.name; from_run := r.run_id; to_run := r.run_id; before_score := r.base_final; after_score := finalv;
      rows_changed := 0; quotes_added := 0; note := 'unchanged'; RETURN NEXT; CONTINUE;
    END IF;

    capv := CASE WHEN jsonb_array_length(caps) > 0 THEN round((SELECT min((x->>'cap')::numeric) FROM jsonb_array_elements(caps) x)*100, 1) ELSE NULL END;
    cap_reason := CASE WHEN jsonb_array_length(caps) > 0 THEN (SELECT string_agg(x->>'reason', ' | ') FROM jsonb_array_elements(caps) x) ELSE NULL END;
    band := CASE WHEN finalv >= 95 THEN 'exceptional' WHEN finalv >= 85 THEN 'top' WHEN finalv >= 70 THEN 'strong' WHEN finalv >= 50 THEN 'consider' ELSE 'not_recommended' END;
    fit := CASE WHEN r.base_fit = 'unknown' THEN 'unknown'
                WHEN band IN ('exceptional','top','strong') THEN CASE WHEN must_cov < minmust THEN 'worth_considering' ELSE 'strong_fit' END
                WHEN band = 'consider' THEN 'worth_considering' ELSE 'not_a_fit' END;
    wshare := CASE WHEN (wm+wp) > 0 THEN round(((CASE WHEN must_n>0 THEN hm::numeric/must_n ELSE 0 END)*wm + (CASE WHEN pref_n>0 THEN hp::numeric/pref_n ELSE 0 END)*wp)/(wm+wp), 4) ELSE 0 END;
    explanation := replace(fit,'_',' ') || ' — score ' || finalv::text || '/100 after human review · must-have coverage ' || round(must_cov*100)::text || '% · '
                   || human_n::text || ' of ' || (must_n+pref_n)::text || ' criteria human-verified' || coalesce(' · caps: ' || cap_reason, '');
    new_id := gen_random_uuid();
    hash := regexp_replace(coalesce(r.input_hash,'none'), '\+human:[0-9a-f]+$', '') || '+human:' || left(new_id::text, 8);
    result_new := r.result || jsonb_build_object(
      'requirement_assessment', rows_new, 'evidence', ev_new,
      'category_breakdown', jsonb_build_object('must_have', round(must_cov,4), 'preferred', round(pref_cov,4), 'screening_alignment', scr),
      'evaluation_method', 'human_adjusted', 'applied_caps', caps, 'raw_score', rawv, 'score', finalv, 'final_score', finalv,
      'fit_label', fit, 'must_have_coverage', round(must_cov,4), 'preferred_coverage', round(pref_cov,4),
      'strengths', strengths, 'concerns', concerns, 'input_hash', hash, 'completed_at', ts, 'actor_user_id', NULL,
      'reason', 'Reviewed requirement verdicts scored by the platform formula',
      'human_adjustment', jsonb_build_object('derived_from_run_id', r.run_id, 'actor_user_id', NULL, 'actor_name', 'TaaSFlow review',
                           'reason', coalesce(r.ov_reason, 'Reviewed requirement verdicts applied'), 'at', ts, 'verdicts', applied, 'unknown_requirement_ids', '[]'::jsonb),
      'verified_evidence', jsonb_build_object('total', must_n+pref_n, 'human_verified', human_n, 'machine_derived', must_n+pref_n-human_n,
                           'weighted_share', wshare, 'count_share', round(human_n::numeric/(must_n+pref_n),4),
                           'line', human_n::text || ' of ' || (must_n+pref_n)::text || ' criteria human-verified (' || round(wshare*100)::text || '% of the score''s weight).'),
      'reconciliation', jsonb_build_object('raw_computed', rawv, 'raw_declared', rawv, 'final_computed', finalv, 'final_declared', finalv,
                        'applied_cap', capv, 'cap_reasons', (SELECT coalesce(jsonb_agg(x->>'reason'), '[]'::jsonb) FROM jsonb_array_elements(caps) x), 'ok', true));

    match_id := r.mid; full_name := r.name; from_run := r.run_id; to_run := CASE WHEN p_apply THEN new_id ELSE NULL END;
    before_score := r.base_final; after_score := finalv; rows_changed := changed; quotes_added := added;
    note := CASE WHEN p_apply THEN 'written' ELSE 'dry run' END;
    IF NOT p_apply THEN RETURN NEXT; CONTINUE; END IF;

    INSERT INTO score_runs (id, candidate_match_id, position_id, application_id, candidate_profile_id, candidate_submission_id, organization_id,
      blueprint_version, rubric_version_id, raw_score, applied_cap, cap_reason, final_score, evaluation_method, fit_band, engine_version, score,
      confidence, evidence_confidence, status, explanation, evidence, requirement_coverage, started_at, completed_at, trace_id, result,
      fit_label, must_have_coverage, preferred_coverage, contradiction_status, input_hash, is_test_record)
    VALUES (new_id, r.mid, r.position_id, r.application_id, r.candidate_profile_id, r.application_id, r.organization_id,
      r.blueprint_version, r.rubric_version_id, rawv, capv, cap_reason, finalv, 'human_adjusted', fit, r.engine_version, finalv,
      r.confidence, r.evidence_confidence, 'running', explanation, ev_new,
      jsonb_build_object('must_have', round(must_cov,4), 'preferred', round(pref_cov,4), 'screening_alignment', scr,
                         'category_weights', jsonb_build_object('must_have', wm, 'preferred', wp, 'screening_alignment', ws),
                         'requirement_assessment', rows_new),
      ts, NULL, 'human-adj-' || left(r.mid::text, 8) || '-' || floor(extract(epoch from ts))::bigint::text, result_new,
      fit, round(must_cov,4), round(pref_cov,4), r.contradiction_status, hash, false);
    UPDATE score_runs SET superseded_at = ts, superseded_by_run_id = new_id, superseded_reason = 'human_adjusted' WHERE id = r.run_id;
    UPDATE score_runs SET status = 'completed', completed_at = ts WHERE id = new_id;
    UPDATE candidate_matches SET current_score_run_id = new_id,
      approved_score_run_id = CASE WHEN approved_score_run_id = r.run_id THEN new_id ELSE approved_score_run_id END
      WHERE id = r.mid;
    INSERT INTO score_decisions (candidate_match_id, score_run_id, decision_type, approved_score, reason, actor_user_id, reason_code)
    VALUES (r.mid, new_id, 'override', finalv, 'Reviewed requirement verdicts scored by the platform formula (human-adjusted run ' || left(new_id::text,8) || ').', NULL, 'claude_primary_review');
    INSERT INTO audit_events (actor_user_id, organization_id, entity_type, entity_id, action, before_state, after_state, trace_id)
    VALUES (NULL, r.organization_id, 'candidate_match', r.mid, 'score_human_adjusted',
      jsonb_build_object('run_id', r.run_id, 'final_score', coalesce(r.base_final, r.base_score), 'fit_label', r.base_fit, 'evaluation_method', r.evaluation_method),
      jsonb_build_object('run_id', new_id, 'final_score', finalv, 'fit_label', fit, 'evaluation_method', 'human_adjusted',
                         'reason', 'Reviewed requirement verdicts scored by the platform formula; quotes added so the client shows the same verdicts.',
                         'rows_changed', changed, 'quotes_added', added,
                         'verdicts', (SELECT coalesce(jsonb_agg(jsonb_build_object('requirement_id', x->>'requirement_id', 'verdict', x->>'verdict', 'machine_status', x->>'machine_status')), '[]'::jsonb) FROM jsonb_array_elements(applied) x),
                         'verified_share', wshare, 'approved_run_repointed', (r.appr = r.run_id)),
      'human-adj-' || left(r.mid::text, 8));
    IF market_key IS NOT NULL AND finalv >= 70
       AND NOT EXISTS (SELECT 1 FROM audit_events ae WHERE ae.entity_id = r.mid AND ae.action = 'evidence_gate_override') THEN
      INSERT INTO audit_events (actor_user_id, organization_id, entity_type, entity_id, action, before_state, after_state, trace_id)
      VALUES (NULL, r.organization_id, 'candidate_match', r.mid, 'evidence_gate_override', NULL,
        jsonb_build_object('criterion_key', market_key, 'criterion_label', missing_req,
          'justification', 'Target-market experience is not evidenced in the CV or the screening answers. The requirement row stays "not evidenced" for the client, the score already reflects the gap (' || finalv::text || '/100), and the candidate may be published on that basis. Recorded by the primary review; publishing remains the owner''s decision.',
          'score_run_id', new_id, 'recorded_by', 'TaaSFlow review'),
        'gate-override-' || left(r.mid::text, 8));
    END IF;
    RETURN NEXT;
  END LOOP;
END $fn$;

-- reapply_claude_overrides (migration 0008) carried a number; numbers now come
-- from the run. Kept as a thin wrapper so an old runbook step still works.
CREATE OR REPLACE FUNCTION public.reapply_claude_overrides(p_position_id uuid, p_apply boolean DEFAULT false)
RETURNS TABLE(match_id uuid, from_run uuid, to_run uuid, score numeric, applied boolean)
LANGUAGE sql SET search_path TO 'public' AS $fn$
  SELECT v.match_id, v.from_run, v.to_run, v.after_score, p_apply AND v.note = 'written'
  FROM public.apply_reviewed_verdicts(p_position_id, p_apply) v;
$fn$;

CREATE OR REPLACE FUNCTION public.tg_candidate_matches_publish_gate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE r RECORD;
BEGIN
  IF NEW.client_visibility='visible' AND NEW.approved_score_run_id IS NULL THEN
    RAISE EXCEPTION 'publish gate: cannot mark visible without approved_score_run_id'
      USING ERRCODE='check_violation';
  END IF;
  IF NEW.approved_score_run_id IS NULL THEN RETURN NEW; END IF;

  IF TG_OP='UPDATE'
     AND OLD.approved_score_run_id IS NOT DISTINCT FROM NEW.approved_score_run_id
     AND OLD.client_visibility IS NOT DISTINCT FROM NEW.client_visibility THEN
    RETURN NEW;
  END IF;

  SELECT candidate_match_id, position_id, application_id, candidate_profile_id,
         organization_id, status, evidence, raw_score, applied_cap, final_score,
         contradiction_status
    INTO r FROM public.score_runs WHERE id = NEW.approved_score_run_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'publish gate: approved_score_run_id % not found', NEW.approved_score_run_id
      USING ERRCODE='foreign_key_violation';
  END IF;
  IF r.candidate_match_id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'publish gate: approved run belongs to a different match';
  END IF;
  IF r.position_id IS DISTINCT FROM NEW.position_id
     OR r.application_id IS DISTINCT FROM NEW.application_id
     OR r.candidate_profile_id IS DISTINCT FROM NEW.candidate_profile_id
     OR r.organization_id IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'publish gate: approved run identity mismatch';
  END IF;
  IF r.status IS DISTINCT FROM 'completed'::public.score_status THEN
    RAISE EXCEPTION 'publish gate: approved run status=% (must be completed)', r.status;
  END IF;
  IF r.contradiction_status = 'disqualifying_answer' THEN
    RAISE EXCEPTION 'publish gate: approved run has a disqualifying contradiction';
  END IF;
  -- Empty structured evidence is allowed here because admin approval is a manual judgement path.
  -- The client UI still receives the parsed candidate profile, score explanation, screening answers, and CV snapshot.
  IF r.final_score > r.applied_cap OR r.final_score > r.raw_score THEN
    RAISE EXCEPTION 'publish gate: math invariant broken';
  END IF;
  RETURN NEW;
END $function$;
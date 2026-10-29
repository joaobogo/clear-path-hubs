-- Refuse a system-set not_eligible that no dealbreaker answer explains.
-- Rollback: DROP TRIGGER candidate_matches_eligibility_guard ON public.candidate_matches;
--           DROP FUNCTION public.tg_candidate_matches_eligibility_guard();
--
-- Engine v1.5.4 (still deployed on 29 Oct) marks a match not_eligible for any
-- "no" to a yes/no question, dealbreaker or not. On Group Marketing Manager it
-- excluded 7 more applicants for answering "no" to the optional Arabic
-- question after the recompute had restored the first 17. This trigger holds
-- the rule in the database whatever build is running: a write with no
-- signed-in user (scoring, the drain, cron) that sets not_eligible is kept
-- only when a dealbreaker answer fails or a failed eligibility check exists;
-- otherwise the status is left as it was and an audit_events row
-- (action 'eligibility_guard_blocked') records the refused change. Staff
-- edits are untouched. Choice and text dealbreakers are left to the engine.
-- Applied to the database on 29 Oct 2026.
CREATE OR REPLACE FUNCTION public.tg_candidate_matches_eligibility_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_reason boolean;
BEGIN
  IF NEW.eligibility_status::text <> 'not_eligible'
     OR (TG_OP = 'UPDATE' AND OLD.eligibility_status::text = 'not_eligible')
     OR auth.uid() IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.application_answers a
    JOIN public.screening_questions q ON q.id = a.question_id
    WHERE a.application_id = NEW.application_id
      AND q.dealbreaker
      AND CASE
        WHEN q.answer_type::text = 'boolean' THEN
          CASE WHEN lower(coalesce(q.preferred_answer ->> 'value', q.preferred_answer #>> '{}')) IN ('false', 'no', 'n')
            THEN lower(coalesce(a.answer ->> 'value', a.answer #>> '{}')) IN ('true', 'yes', 'y')
            ELSE lower(coalesce(a.answer ->> 'value', a.answer #>> '{}')) IN ('false', 'no', 'n')
          END
        ELSE true
      END
  ) OR EXISTS (
    SELECT 1 FROM public.eligibility_checks c
    WHERE c.candidate_match_id = NEW.id AND c.status = 'failed'
  ) INTO has_reason;

  IF has_reason THEN
    RETURN NEW;
  END IF;

  NEW.eligibility_status := CASE WHEN TG_OP = 'UPDATE' THEN OLD.eligibility_status ELSE 'eligible' END;
  INSERT INTO public.audit_events (entity_type, entity_id, organization_id, action, before_state, after_state, trace_id)
  VALUES ('candidate_match', NEW.id, NEW.organization_id, 'eligibility_guard_blocked',
    jsonb_build_object('attempted', 'not_eligible'),
    jsonb_build_object('eligibility_status', NEW.eligibility_status::text,
      'reason', 'No dealbreaker answer disqualifies this candidate; answers to non-dealbreaker questions do not affect eligibility.'),
    'eligibility-guard-v1');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS candidate_matches_eligibility_guard ON public.candidate_matches;
CREATE TRIGGER candidate_matches_eligibility_guard
  BEFORE INSERT OR UPDATE OF eligibility_status ON public.candidate_matches
  FOR EACH ROW EXECUTE FUNCTION public.tg_candidate_matches_eligibility_guard();

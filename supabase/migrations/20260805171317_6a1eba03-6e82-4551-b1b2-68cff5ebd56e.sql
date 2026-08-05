ALTER TABLE public.screening_questions
  ADD COLUMN IF NOT EXISTS why_asked text,
  ADD COLUMN IF NOT EXISTS must_have text;

-- Prohibited topics: protected characteristics and common proxies for them.
CREATE OR REPLACE FUNCTION public.screening_question_prohibited(_q text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT lower(coalesce(_q, '')) ~ (
    'how old are you|your age|date of birth|birth date|year (were|was) you born'
    || '|nationality|what nationality|citizen of|citizenship|ethnic|race|birthplace|country of birth|native language'
    || '|marital status|are you married|do you have (a )?(husband|wife|spouse|children|kids)|pregnan|planning a family|childcare arrangements'
    || '|health condition|medical history|disabilit|chronic illness|mental health|sick days|do you smoke'
    || '|religio|which church|do you attend (church|mosque|synagogue)|caste'
  );
$$;

CREATE OR REPLACE FUNCTION public.tg_screening_question_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  n int;
BEGIN
  IF public.screening_question_prohibited(NEW.question) THEN
    RAISE EXCEPTION 'screening_question_prohibited_topic'
      USING HINT = 'Questions may not ask about age, nationality, marital or family status, health, disability or religion.';
  END IF;

  SELECT count(*) INTO n
  FROM public.screening_questions
  WHERE position_id = NEW.position_id
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF n + 1 > 5 THEN
    RAISE EXCEPTION 'screening_question_limit_exceeded'
      USING HINT = 'A posting may have at most five screening questions.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_screening_question_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.screening_question_prohibited(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.screening_question_prohibited(text) TO authenticated, service_role;

DROP TRIGGER IF EXISTS screening_question_guard ON public.screening_questions;
CREATE TRIGGER screening_question_guard
BEFORE INSERT OR UPDATE ON public.screening_questions
FOR EACH ROW EXECUTE FUNCTION public.tg_screening_question_guard();

-- Publish gate: a role cannot go live with more than five questions, or with a
-- question that is not tied to a stated must-have on the brief.
CREATE OR REPLACE FUNCTION public.tg_position_screening_publish_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  total int;
  unmapped int;
BEGIN
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
    SELECT count(*), count(*) FILTER (
      WHERE coalesce(btrim(must_have), '') = '' OR coalesce(btrim(why_asked), '') = ''
    )
    INTO total, unmapped
    FROM public.screening_questions
    WHERE position_id = NEW.id;

    IF total > 5 THEN
      RAISE EXCEPTION 'position_screening_limit_exceeded'
        USING HINT = 'Trim the posting to five screening questions before publishing.';
    END IF;
    IF unmapped > 0 THEN
      RAISE EXCEPTION 'position_screening_unmapped'
        USING HINT = 'Every published question needs a linked must-have and a one-line reason for asking.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_position_screening_publish_gate() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS position_screening_publish_gate ON public.positions;
CREATE TRIGGER position_screening_publish_gate
BEFORE INSERT OR UPDATE OF status ON public.positions
FOR EACH ROW EXECUTE FUNCTION public.tg_position_screening_publish_gate();
CREATE OR REPLACE FUNCTION public.tg_screening_question_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  n int;
  lim int := 5;
BEGIN
  IF public.screening_question_prohibited(NEW.question) THEN
    RAISE EXCEPTION 'screening_question_prohibited_topic'
      USING HINT = 'Questions may not ask about age, nationality, marital or family status, health, disability or religion.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.positions p WHERE p.id = NEW.position_id AND p.scoring_mode = 'relocation_volume') THEN
    lim := 8;
  END IF;

  SELECT count(*) INTO n
  FROM public.screening_questions
  WHERE position_id = NEW.position_id
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF n + 1 > lim THEN
    RAISE EXCEPTION 'screening_question_limit_exceeded'
      USING HINT = format('A posting may have at most %s screening questions.', lim);
  END IF;

  RETURN NEW;
END;
$function$;
-- 1 + 2. Hire record coherence, enforced at write time.
CREATE OR REPLACE FUNCTION public.enforce_hire_record_coherence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'hire_confirmed'::public.hire_status THEN
    IF NEW.close_reason IS NOT NULL OR NEW.declined_at IS NOT NULL OR NEW.closed_at IS NOT NULL THEN
      RAISE EXCEPTION 'A confirmed hire cannot carry a close reason, declined date or closed date'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.status IN ('closed_lost'::public.hire_status, 'offer_declined'::public.hire_status) THEN
    IF NEW.hired_at IS NOT NULL THEN
      RAISE EXCEPTION 'A closed or declined offer cannot carry a hire date'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hire_record_coherence ON public.hire_records;
CREATE TRIGGER trg_hire_record_coherence
BEFORE INSERT OR UPDATE ON public.hire_records
FOR EACH ROW EXECUTE FUNCTION public.enforce_hire_record_coherence();

-- 3. Sweep interviews whose slot has passed out of "scheduled".
CREATE OR REPLACE FUNCTION public.sweep_stale_scheduled_interviews()
RETURNS TABLE(completed_count integer, no_show_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completed integer := 0;
  v_no_show integer := 0;
BEGIN
  WITH stale AS (
    SELECT id
    FROM public.interviews
    WHERE status = 'scheduled'::public.interview_status
      AND scheduled_at IS NOT NULL
      AND scheduled_at + (COALESCE(duration_minutes, 60) || ' minutes')::interval
          < now() - interval '2 hours'
      AND candidate_response = 'confirmed'
      AND no_show_flagged_at IS NULL
  ), upd AS (
    UPDATE public.interviews i
       SET status = 'completed'::public.interview_status,
           completed_at = COALESCE(
             i.completed_at,
             i.scheduled_at + (COALESCE(i.duration_minutes, 60) || ' minutes')::interval
           ),
           updated_at = now()
      FROM stale s
     WHERE i.id = s.id
     RETURNING i.id
  )
  SELECT count(*)::integer INTO v_completed FROM upd;

  WITH stale AS (
    SELECT id
    FROM public.interviews
    WHERE status = 'scheduled'::public.interview_status
      AND scheduled_at IS NOT NULL
      AND scheduled_at + (COALESCE(duration_minutes, 60) || ' minutes')::interval
          < now() - interval '2 hours'
  ), upd AS (
    UPDATE public.interviews i
       SET status = 'cancelled'::public.interview_status,
           no_show_flagged_at = COALESCE(i.no_show_flagged_at, now()),
           cancelled_at = COALESCE(i.cancelled_at, now()),
           cancel_reason = COALESCE(
             i.cancel_reason,
             'candidate_no_show: slot passed without confirmation'
           ),
           updated_at = now()
      FROM stale s
     WHERE i.id = s.id
     RETURNING i.id
  )
  SELECT count(*)::integer INTO v_no_show FROM upd;

  RETURN QUERY SELECT v_completed, v_no_show;
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_stale_scheduled_interviews() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_stale_scheduled_interviews() TO service_role;
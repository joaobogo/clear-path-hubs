-- 1) Extend the canonical event catalogue
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'position_updated';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'position_reopened';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'cv_parsed';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'cv_parse_failed';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'screening_completed';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'screening_needs_review';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'contact_released';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'contact_revoked';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'client_viewed_candidate';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'interview_completed';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'interview_cancelled';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'candidate_stage_changed';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'document_added';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'member_invited';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'member_removed';

-- 2) Interview lifecycle guard (server-side rejection of invalid transitions)
CREATE OR REPLACE FUNCTION public.tg_interviews_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  o text := COALESCE(OLD.status::text, '');
  n text := NEW.status::text;
  allowed boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF n NOT IN ('requested','scheduling','scheduled') THEN
      RAISE EXCEPTION 'invalid_interview_initial_status: %', n USING ERRCODE = 'check_violation';
    END IF;
  ELSIF o <> n THEN
    allowed := CASE
      WHEN o = 'requested'  AND n IN ('scheduling','scheduled','cancelled') THEN true
      WHEN o = 'scheduling' AND n IN ('scheduled','cancelled') THEN true
      WHEN o = 'scheduled'  AND n IN ('completed','cancelled','scheduling') THEN true
      WHEN o = 'cancelled'  AND n IN ('requested','scheduling') THEN true
      ELSE false
    END;
    IF NOT allowed THEN
      RAISE EXCEPTION 'invalid_interview_transition: % -> %', o, n USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.status::text = 'completed' AND NEW.completed_at IS NULL THEN NEW.completed_at := now(); END IF;
  IF NEW.status::text = 'cancelled' AND NEW.cancelled_at IS NULL THEN NEW.cancelled_at := now(); END IF;
  IF NEW.status::text = 'scheduled' AND NEW.scheduled_at IS NULL THEN
    RAISE EXCEPTION 'scheduled_at_required: a scheduled interview needs a time' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS interviews_lifecycle ON public.interviews;
CREATE TRIGGER interviews_lifecycle
BEFORE INSERT OR UPDATE ON public.interviews
FOR EACH ROW EXECUTE FUNCTION public.tg_interviews_lifecycle();

-- 3) Candidate pipeline stage guard
CREATE OR REPLACE FUNCTION public.tg_candidate_matches_stage_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  o text := OLD.stage::text;
  n text := NEW.stage::text;
  allowed boolean := false;
BEGIN
  IF o = n THEN RETURN NEW; END IF;
  allowed := CASE
    WHEN o = 'new'                AND n IN ('reviewing','delivered','not_moving_forward','archived') THEN true
    WHEN o = 'reviewing'          AND n IN ('delivered','not_moving_forward','archived') THEN true
    WHEN o = 'delivered'          AND n IN ('shortlisted','interview_process','not_moving_forward','archived','reviewing') THEN true
    WHEN o = 'shortlisted'        AND n IN ('interview_process','offer','not_moving_forward','archived','delivered') THEN true
    WHEN o = 'interview_process'  AND n IN ('offer','not_moving_forward','archived','shortlisted') THEN true
    WHEN o = 'offer'              AND n IN ('hired','not_moving_forward','archived','interview_process') THEN true
    WHEN o = 'hired'              AND n IN ('archived') THEN true
    WHEN o = 'not_moving_forward' AND n IN ('delivered','shortlisted','archived') THEN true
    WHEN o = 'archived'           AND n IN ('delivered') THEN true
    ELSE false
  END;
  IF NOT allowed THEN
    RAISE EXCEPTION 'invalid_stage_transition: % -> %', o, n USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS candidate_matches_stage_guard ON public.candidate_matches;
CREATE TRIGGER candidate_matches_stage_guard
BEFORE UPDATE OF stage ON public.candidate_matches
FOR EACH ROW EXECUTE FUNCTION public.tg_candidate_matches_stage_guard();

-- 4) Role-scoped activity feed derived from the single source event table.
--    security_invoker keeps the caller's RLS on notification_events, so each
--    role only ever sees the events it is authorised to see.
CREATE OR REPLACE VIEW public.v_activity_feed
WITH (security_invoker = on) AS
SELECT
  e.id                    AS event_id,
  e.event_type,
  e.created_at            AS occurred_at,
  e.organization_id,
  e.position_id,
  e.application_id,
  e.candidate_match_id,
  e.candidate_profile_id,
  e.actor_user_id,
  p.full_name             AS actor_name,
  pos.title               AS position_title,
  pos.status::text        AS position_status,
  e.payload
FROM public.notification_events e
LEFT JOIN public.profiles  p   ON p.auth_user_id = e.actor_user_id
LEFT JOIN public.positions pos ON pos.id = e.position_id;

GRANT SELECT ON public.v_activity_feed TO authenticated;

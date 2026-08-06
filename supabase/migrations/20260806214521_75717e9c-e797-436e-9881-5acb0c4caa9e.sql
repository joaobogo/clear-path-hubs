ALTER TABLE public.candidate_matches
  ADD COLUMN IF NOT EXISTS score_stale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS score_stale_reasons text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS score_stale_at timestamptz,
  ADD COLUMN IF NOT EXISTS rescore_queued_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_candidate_matches_score_stale
  ON public.candidate_matches (score_stale_at)
  WHERE score_stale;

CREATE OR REPLACE FUNCTION public.mark_matches_score_stale(_match_ids uuid[], _reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE n integer;
BEGIN
  IF _match_ids IS NULL OR array_length(_match_ids, 1) IS NULL OR _reason IS NULL THEN
    RETURN 0;
  END IF;
  UPDATE public.candidate_matches m
     SET score_stale = true,
         score_stale_at = COALESCE(m.score_stale_at, now()),
         score_stale_reasons = ARRAY(
           SELECT DISTINCT r FROM unnest(m.score_stale_reasons || ARRAY[_reason]) AS r
           WHERE r IS NOT NULL AND r <> ''
         )
   WHERE m.id = ANY(_match_ids)
     AND m.current_score_run_id IS NOT NULL
     AND (m.score_stale = false OR NOT (_reason = ANY(m.score_stale_reasons)));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_matches_score_stale(uuid[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_matches_score_stale(uuid[], text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_matches_score_stale(uuid[], text) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_position_scores_stale(_position_id uuid, _reason text)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT public.mark_matches_score_stale(
    ARRAY(SELECT id FROM public.candidate_matches WHERE position_id = _position_id),
    _reason
  );
$$;

REVOKE ALL ON FUNCTION public.mark_position_scores_stale(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_position_scores_stale(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_position_scores_stale(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.clear_match_score_stale(_match_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  UPDATE public.candidate_matches
     SET score_stale = false,
         score_stale_reasons = '{}'::text[],
         score_stale_at = NULL,
         rescore_queued_at = NULL
   WHERE id = _match_id;
$$;

REVOKE ALL ON FUNCTION public.clear_match_score_stale(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_match_score_stale(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_match_score_stale(uuid) TO service_role;

-- Role brief changes invalidate every score computed against the old brief.
CREATE OR REPLACE FUNCTION public.tg_positions_invalidate_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.requirements IS DISTINCT FROM OLD.requirements
     OR NEW.preferred_requirements IS DISTINCT FROM OLD.preferred_requirements
     OR NEW.dealbreakers IS DISTINCT FROM OLD.dealbreakers
     OR NEW.evaluation_weights IS DISTINCT FROM OLD.evaluation_weights THEN
    PERFORM public.mark_position_scores_stale(NEW.id, 'requirements_changed');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS positions_invalidate_scores ON public.positions;
CREATE TRIGGER positions_invalidate_scores
AFTER UPDATE ON public.positions
FOR EACH ROW EXECUTE FUNCTION public.tg_positions_invalidate_scores();

CREATE OR REPLACE FUNCTION public.tg_screening_questions_invalidate_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE pid uuid;
BEGIN
  pid := COALESCE(NEW.position_id, OLD.position_id);
  IF pid IS NOT NULL THEN
    PERFORM public.mark_position_scores_stale(pid, 'screening_changed');
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS screening_questions_invalidate_scores ON public.screening_questions;
CREATE TRIGGER screening_questions_invalidate_scores
AFTER INSERT OR UPDATE OR DELETE ON public.screening_questions
FOR EACH ROW EXECUTE FUNCTION public.tg_screening_questions_invalidate_scores();

-- A superseded or newly approved rubric version means the criteria moved.
CREATE OR REPLACE FUNCTION public.tg_rubric_versions_invalidate_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'approved' AND NEW.position_id IS NOT NULL THEN
      PERFORM public.mark_position_scores_stale(NEW.position_id, 'rubric_superseded');
    END IF;
    RETURN NEW;
  END IF;
  IF (NEW.superseded_at IS DISTINCT FROM OLD.superseded_at AND NEW.superseded_at IS NOT NULL)
     OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'superseded')) THEN
    PERFORM public.mark_position_scores_stale(NEW.position_id, 'rubric_superseded');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rubric_versions_invalidate_scores ON public.rubric_versions;
CREATE TRIGGER rubric_versions_invalidate_scores
AFTER INSERT OR UPDATE ON public.rubric_versions
FOR EACH ROW EXECUTE FUNCTION public.tg_rubric_versions_invalidate_scores();

-- A newer CV replaces the evidence the score was built on.
CREATE OR REPLACE FUNCTION public.tg_candidate_profiles_invalidate_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.current_cv_file_id IS DISTINCT FROM OLD.current_cv_file_id
     AND NEW.current_cv_file_id IS NOT NULL THEN
    PERFORM public.mark_matches_score_stale(
      ARRAY(SELECT id FROM public.candidate_matches WHERE candidate_profile_id = NEW.id),
      'new_cv'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS candidate_profiles_invalidate_scores ON public.candidate_profiles;
CREATE TRIGGER candidate_profiles_invalidate_scores
AFTER UPDATE ON public.candidate_profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_candidate_profiles_invalidate_scores();
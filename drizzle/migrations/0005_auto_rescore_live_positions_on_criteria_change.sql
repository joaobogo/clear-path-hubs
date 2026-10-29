-- Requirement / screening changes on a live role queue every active match for
-- rescoring straight away (the 2-minute drain picks up ready_to_score), instead
-- of waiting for the nightly freshness job. Score runs stay immutable: the
-- drain inserts new runs. Rollback: re-create the two trigger functions from
-- migration 20260806214521 (mark stale only).
CREATE OR REPLACE FUNCTION public.queue_position_rescore(_position_id uuid, _reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE n integer := 0; org uuid; st text;
BEGIN
  SELECT organization_id, status::text INTO org, st FROM public.positions WHERE id = _position_id;
  IF st IS NULL OR st NOT IN ('approved', 'active') THEN
    RETURN 0;
  END IF;
  UPDATE public.candidate_matches
     SET processing_state = 'ready_to_score',
         rescore_queued_at = now()
   WHERE position_id = _position_id
     AND stage NOT IN ('archived', 'hired')
     AND processing_state NOT IN ('queued', 'parsing', 'ocr_required', 'enriching', 'scoring', 'ready_to_score')
     AND current_score_run_id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    INSERT INTO public.audit_events (organization_id, entity_type, entity_id, action, after_state)
    VALUES (org, 'position', _position_id, 'scoring.requirements_rescore_batch',
            jsonb_build_object('queued', n, 'reason', _reason));
  END IF;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_position_rescore(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_position_rescore(uuid, text) TO service_role;

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
    PERFORM public.queue_position_rescore(NEW.id, 'requirements_changed');
  END IF;
  RETURN NEW;
END;
$$;

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
    PERFORM public.queue_position_rescore(pid, 'screening_changed');
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION public.tg_positions_invalidate_scores() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_screening_questions_invalidate_scores() FROM PUBLIC, anon, authenticated;

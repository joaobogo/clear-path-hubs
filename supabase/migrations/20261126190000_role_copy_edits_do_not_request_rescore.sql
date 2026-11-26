-- A wording-only edit to a role must not request a re-score.
--
-- tg_positions_version_snapshot keeps a version of the role whenever its
-- content changes, and until now also set rescore_state = 'pending' and
-- rescore_requested_at on every such change. intake_context holds the job-post
-- copy (posting.*), so saving a headline or a travel line on 26 Nov 2026 asked
-- for a re-score on two live roles although nothing the scorer reads had moved.
--
-- The version snapshot still happens for every content change. The re-score
-- request is set only when something the scorer reads changes: the title (its
-- words are excluded from evidence), the requirements, the dealbreakers, the
-- weights or the scoring mode. Screening questions live in their own table and
-- mark matches stale through their own trigger.
CREATE OR REPLACE FUNCTION public.tg_positions_version_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_next integer;
  v_content_changed boolean;
  v_scoring_changed boolean;
BEGIN
  v_scoring_changed :=
    OLD.title IS DISTINCT FROM NEW.title
    OR OLD.requirements IS DISTINCT FROM NEW.requirements
    OR OLD.preferred_requirements IS DISTINCT FROM NEW.preferred_requirements
    OR OLD.dealbreakers IS DISTINCT FROM NEW.dealbreakers
    OR OLD.evaluation_weights IS DISTINCT FROM NEW.evaluation_weights
    OR OLD.scoring_mode IS DISTINCT FROM NEW.scoring_mode;

  v_content_changed :=
    v_scoring_changed
    OR OLD.description IS DISTINCT FROM NEW.description
    OR OLD.seniority IS DISTINCT FROM NEW.seniority
    OR OLD.employment_type IS DISTINCT FROM NEW.employment_type
    OR OLD.work_model IS DISTINCT FROM NEW.work_model
    OR OLD.intake_context IS DISTINCT FROM NEW.intake_context;

  IF NOT v_content_changed THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(max(version_number), 0) + 1 INTO v_next
    FROM public.position_versions WHERE position_id = OLD.id;

  INSERT INTO public.position_versions (
    position_id, organization_id, version_number, title, description,
    requirements, preferred_requirements, dealbreakers, compensation,
    intake_context, snapshot, created_by
  ) VALUES (
    OLD.id, OLD.organization_id, v_next, OLD.title, OLD.description,
    OLD.requirements, OLD.preferred_requirements, OLD.dealbreakers, OLD.compensation,
    OLD.intake_context, to_jsonb(OLD), auth.uid()
  );

  NEW.content_version := v_next + 1;
  IF v_scoring_changed THEN
    NEW.rescore_state := 'pending';
    NEW.rescore_requested_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

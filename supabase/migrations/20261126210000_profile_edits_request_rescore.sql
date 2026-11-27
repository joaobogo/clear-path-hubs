-- A profile edit asks for a re-score.
--
-- The scorer now reads the candidate's current profile (headline, summary and
-- experience entries) beside the original CV, where a person is on record as
-- having written the field, so a recruiter's correction to any of them
-- changes what the score should say. The match is flagged the
-- same way a newer CV flags it, the nightly reconciliation queues the normal
-- re-score, and a recruiter's review on the match is put back on the new run.
--
-- Only live matches are flagged. A rejected or archived match, or one whose
-- application was withdrawn, keeps the score it was closed with.

CREATE OR REPLACE FUNCTION public.tg_candidate_profiles_invalidate_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NEW.current_cv_file_id IS DISTINCT FROM OLD.current_cv_file_id
     AND NEW.current_cv_file_id IS NOT NULL THEN
    PERFORM public.mark_matches_score_stale(
      ARRAY(SELECT id FROM public.candidate_matches WHERE candidate_profile_id = NEW.id),
      'new_cv'
    );
  END IF;

  -- The text, or the record of who wrote it: the scorer reads a field only
  -- where a person is on record as its author, so recording that is a change
  -- to what gets scored.
  IF NEW.headline IS DISTINCT FROM OLD.headline
     OR NEW.summary IS DISTINCT FROM OLD.summary
     OR NEW.experience IS DISTINCT FROM OLD.experience
     OR (NEW.consent #> '{provenance,headline}') IS DISTINCT FROM (OLD.consent #> '{provenance,headline}')
     OR (NEW.consent #> '{provenance,summary}') IS DISTINCT FROM (OLD.consent #> '{provenance,summary}')
     OR (NEW.consent #> '{provenance,experience}') IS DISTINCT FROM (OLD.consent #> '{provenance,experience}') THEN
    PERFORM public.mark_matches_score_stale(
      ARRAY(
        SELECT m.id
          FROM public.candidate_matches m
          LEFT JOIN public.applications a ON a.id = m.application_id
         WHERE m.candidate_profile_id = NEW.id
           AND m.admin_status::text <> 'rejected'
           AND m.stage::text <> 'archived'
           AND m.client_visibility::text <> 'archived'
           AND a.withdrawn_at IS NULL
      ),
      'profile_edited'
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Carry Claude's primary-review overrides onto a match's new score run.
-- Rollback: DROP FUNCTION public.reapply_claude_overrides(uuid, boolean);
--
-- Overrides are tied to a score run, so a rescore leaves the recruiter's
-- score behind on the superseded run and the ranking falls back to the engine
-- number. For each match on the position, this copies the latest override
-- with reason_code 'claude_primary_review' onto the current run, unless the
-- current run already has an override. Dry run by default:
--   SELECT * FROM public.reapply_claude_overrides('<position id>');        -- preview
--   SELECT * FROM public.reapply_claude_overrides('<position id>', true);  -- apply
-- Applied to the database on 30 Oct 2026.
CREATE OR REPLACE FUNCTION public.reapply_claude_overrides(p_position_id uuid, p_apply boolean DEFAULT false)
RETURNS TABLE (match_id uuid, from_run uuid, to_run uuid, score numeric, applied boolean)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (d.candidate_match_id) d.candidate_match_id mid, d.score_run_id run_id, d.approved_score s, d.reason, m.current_score_run_id cur
    FROM score_decisions d JOIN candidate_matches m ON m.id = d.candidate_match_id
    WHERE m.position_id = p_position_id AND d.decision_type = 'override' AND d.reason_code = 'claude_primary_review'
    ORDER BY d.candidate_match_id, d.created_at DESC, d.id DESC
  LOOP
    CONTINUE WHEN r.cur IS NULL OR r.cur = r.run_id;
    CONTINUE WHEN EXISTS (SELECT 1 FROM score_decisions x WHERE x.candidate_match_id = r.mid AND x.score_run_id = r.cur AND x.decision_type = 'override');
    IF p_apply THEN
      INSERT INTO score_decisions (candidate_match_id, score_run_id, decision_type, approved_score, reason, actor_user_id, reason_code)
      VALUES (r.mid, r.cur, 'override', r.s, r.reason || ' (carried to the rescored run)', NULL, 'claude_primary_review');
    END IF;
    match_id := r.mid; from_run := r.run_id; to_run := r.cur; score := r.s; applied := p_apply;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Eligibility from dealbreaker answers only. Adds a function; changes no data on its own.
-- Rollback: DROP FUNCTION public.recompute_screening_eligibility(uuid, boolean);
--
-- Until engine v1.7.0, scoring set eligibility_status = 'not_eligible' for any
-- "no" to a yes/no screening question, dealbreaker or not, and the
-- eligibility_checks row meant to record why was rejected by that table's
-- status check on every write. This function recomputes the status from
-- dealbreaker answers alone:
--   * a not_eligible match with no disqualifying dealbreaker answer becomes
--     eligible, with an audit_events row saying why;
--   * a match that does fail a dealbreaker gets the eligibility_checks row it
--     never received.
-- It is idempotent (a second run changes nothing) and defaults to a dry run:
--   SELECT * FROM public.recompute_screening_eligibility('<position id>');        -- preview
--   SELECT * FROM public.recompute_screening_eligibility('<position id>', true);  -- apply
-- A NULL position covers every position.
CREATE OR REPLACE FUNCTION public.recompute_screening_eligibility(
  p_position_id uuid DEFAULT NULL,
  p_apply boolean DEFAULT false
)
RETURNS TABLE (
  match_id uuid,
  position_id uuid,
  eligibility_before text,
  eligibility_after text,
  failed_dealbreakers text[],
  applied boolean
)
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  r record;
BEGIN
  FOR r IN
    WITH answers AS (
      SELECT
        m.id AS m_id,
        q.id AS q_id,
        q.question,
        lower(coalesce(a.answer ->> 'value', a.answer #>> '{}')) AS given,
        lower(coalesce(q.preferred_answer ->> 'value', q.preferred_answer #>> '{}')) AS preferred
      FROM public.candidate_matches m
      JOIN public.application_answers a ON a.application_id = m.application_id
      JOIN public.screening_questions q ON q.id = a.question_id
      WHERE q.dealbreaker AND q.answer_type::text = 'boolean'
        AND (p_position_id IS NULL OR m.position_id = p_position_id)
    ),
    failing AS (
      -- The disqualifying answer is the opposite of the preferred one; with no
      -- preference recorded, "no" disqualifies (the engine's rule).
      SELECT m_id, q_id, question, given
      FROM answers
      WHERE CASE
        WHEN preferred IN ('false', 'no', 'n') THEN given IN ('true', 'yes', 'y')
        ELSE given IN ('false', 'no', 'n')
      END
    )
    SELECT
      m.id,
      m.position_id AS pos_id,
      m.organization_id AS org_id,
      m.eligibility_status::text AS before_status,
      coalesce(array_agg(f.question ORDER BY f.question) FILTER (WHERE f.q_id IS NOT NULL), '{}') AS failed,
      coalesce(jsonb_agg(jsonb_build_object('q_id', f.q_id, 'question', f.question, 'given', f.given))
        FILTER (WHERE f.q_id IS NOT NULL), '[]'::jsonb) AS failed_rows
    FROM public.candidate_matches m
    LEFT JOIN failing f ON f.m_id = m.id
    WHERE (p_position_id IS NULL OR m.position_id = p_position_id)
      AND m.eligibility_status::text IN ('not_eligible', 'eligible')
    GROUP BY m.id
  LOOP
    -- Wrongly excluded: not_eligible with no failing dealbreaker.
    IF r.before_status = 'not_eligible' AND cardinality(r.failed) = 0 THEN
      IF p_apply THEN
        UPDATE public.candidate_matches
          SET eligibility_status = 'eligible', eligibility_updated_at = now()
          WHERE id = r.id;
        INSERT INTO public.audit_events (entity_type, entity_id, organization_id, action, before_state, after_state, trace_id)
        VALUES (
          'candidate_match', r.id, r.org_id, 'eligibility_recomputed',
          jsonb_build_object('eligibility_status', 'not_eligible'),
          jsonb_build_object(
            'eligibility_status', 'eligible',
            'reason', 'No dealbreaker answer disqualifies this candidate; answers to non-dealbreaker questions do not affect eligibility.'
          ),
          'eligibility-recompute-v1.7.0'
        );
      END IF;
      match_id := r.id; position_id := r.pos_id;
      eligibility_before := 'not_eligible'; eligibility_after := 'eligible';
      failed_dealbreakers := r.failed; applied := p_apply;
      RETURN NEXT;
    -- Correctly excluded, but with no record of why: write the missing checks.
    ELSIF cardinality(r.failed) > 0 AND NOT EXISTS (
      SELECT 1 FROM public.eligibility_checks c
      WHERE c.candidate_match_id = r.id AND c.qualifier_key LIKE 'disq:%' AND c.status = 'failed'
    ) THEN
      IF p_apply THEN
        INSERT INTO public.eligibility_checks
          (candidate_match_id, organization_id, position_id, qualifier_key, qualifier_label, qualifier_kind, status, reason, evidence)
        SELECT r.id, r.org_id, r.pos_id, 'disq:' || (x ->> 'q_id'), x ->> 'question', 'disqualifier', 'failed',
               'Dealbreaker answer: ' || (x ->> 'given'),
               jsonb_build_object('question_id', x ->> 'q_id', 'value', x ->> 'given')
        FROM jsonb_array_elements(r.failed_rows) x
        ON CONFLICT (candidate_match_id, qualifier_key) DO NOTHING;
      END IF;
      match_id := r.id; position_id := r.pos_id;
      eligibility_before := r.before_status; eligibility_after := r.before_status;
      failed_dealbreakers := r.failed; applied := p_apply;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$fn$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.recompute_screening_eligibility(uuid, boolean) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.recompute_screening_eligibility(uuid, boolean) FROM anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.recompute_screening_eligibility(uuid, boolean) TO service_role;

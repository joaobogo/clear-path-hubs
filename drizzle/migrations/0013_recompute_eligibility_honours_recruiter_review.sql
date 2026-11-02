-- recompute_screening_eligibility honours recruiter decisions (2 Nov 2026).
-- Rollback: re-run the CREATE OR REPLACE in 0006_recompute_screening_eligibility.sql.
-- NOT applied to the database by this commit.
--
-- An eligibility_checks row keyed 'recruiter_review:*' is a recruiter's
-- decision. The engine, the offline rescore and the TypeScript recompute tool
-- (planEligibilityRecompute) already read it; this function, which the
-- criteria-change path calls with p_apply = true, did not:
--   * it inserted a disq: row for a dealbreaker answer the recruiter had
--     excepted, and
--   * it flipped a not_eligible match to eligible whenever no dealbreaker
--     answer failed, undoing a recruiter's 'failed' (and the forced rescore
--     that follows cannot restore it for a CV with no dated roles).
-- The decision is now read here too, and always wins:
--   * 'excepted' or 'passed' with the question id (evidence.question_id when
--     it is a string, else the key suffix after 'recruiter_review:') lifts
--     that question's disqualifying answer: it is not a failing answer and
--     no disq: row is written for it. A lifted not_eligible match reads
--     'excepted' when an exception was granted, else 'eligible'.
--   * 'failed' forces not_eligible whatever the answers, from any status.
--   * 'unknown' (no decision) is ignored.
-- A not_eligible match is also left alone while any other failed check that
-- the engine does not own (a staff qualifier) holds it, as
-- planEligibilityRecompute does. The function never updates or deletes an
-- eligibility_checks row; it only inserts missing disq: rows, as before.
-- Unverified-claim flags (screening_claim_unverified:*, status 'unknown')
-- never enter into it.
--
-- Checked on 2 Nov against a local Postgres 16 with this schema's tables and
-- the 0007 guard trigger: excepted (evidence id) -> 'excepted', passed (key
-- suffix) -> 'eligible', failed from eligible or excepted -> 'not_eligible',
-- failed holding a not_eligible match -> unchanged, 'unknown' ignored, no
-- recruiter row touched, second run returns nothing. A dry run of the same
-- query on the live data (read-only) lists the same two matches the current
-- function lists (missing disq: rows on 0c0a875f and d89936d3) and nothing
-- else.
--
-- Still idempotent and a dry run by default:
--   SELECT * FROM public.recompute_screening_eligibility('<position id>');        -- preview
--   SELECT * FROM public.recompute_screening_eligibility('<position id>', true);  -- apply
-- A NULL position covers every position. Signature and result columns are
-- unchanged, so the generated types are unchanged.
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
  next_status text;
  why text;
  missing boolean;
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
    decisions AS (
      -- Recruiter decisions, with the question each one names.
      SELECT
        c.candidate_match_id AS m_id,
        c.status,
        coalesce(
          CASE WHEN jsonb_typeof(c.evidence -> 'question_id') = 'string'
            THEN nullif(btrim(c.evidence ->> 'question_id'), '') END,
          nullif(btrim(substr(c.qualifier_key, length('recruiter_review:') + 1)), '')
        ) AS q_id
      FROM public.eligibility_checks c
      WHERE c.qualifier_key LIKE 'recruiter_review:%'
        AND c.status IN ('excepted', 'passed', 'failed')
        AND (p_position_id IS NULL OR c.position_id = p_position_id)
    ),
    failing AS (
      -- The disqualifying answer is the opposite of the preferred one; with no
      -- preference recorded, "no" disqualifies (the engine's rule). An answer
      -- a recruiter excepted or passed does not disqualify.
      SELECT a.m_id, a.q_id, a.question, a.given
      FROM answers a
      WHERE CASE
        WHEN a.preferred IN ('false', 'no', 'n') THEN a.given IN ('true', 'yes', 'y')
        ELSE a.given IN ('false', 'no', 'n')
      END
        AND NOT EXISTS (
          SELECT 1 FROM decisions d
          WHERE d.m_id = a.m_id AND d.status IN ('excepted', 'passed') AND d.q_id = a.q_id::text
        )
    )
    SELECT
      m.id,
      m.position_id AS pos_id,
      m.organization_id AS org_id,
      m.eligibility_status::text AS before_status,
      coalesce(array_agg(f.question ORDER BY f.question) FILTER (WHERE f.q_id IS NOT NULL), '{}') AS failed,
      coalesce(jsonb_agg(jsonb_build_object('q_id', f.q_id, 'question', f.question, 'given', f.given))
        FILTER (WHERE f.q_id IS NOT NULL), '[]'::jsonb) AS failed_rows,
      EXISTS (SELECT 1 FROM decisions d WHERE d.m_id = m.id AND d.status = 'failed') AS recruiter_failed,
      EXISTS (SELECT 1 FROM decisions d WHERE d.m_id = m.id AND d.status = 'excepted') AS recruiter_excepted,
      -- A failed check the engine does not rebuild (a recruiter's 'failed', a
      -- staff qualifier) keeps a not_eligible match where it is.
      EXISTS (
        SELECT 1 FROM public.eligibility_checks c
        WHERE c.candidate_match_id = m.id AND c.status = 'failed'
          AND c.qualifier_key NOT LIKE 'disq:%'
          AND c.qualifier_key NOT LIKE 'screening_claim_unverified:%'
          AND c.qualifier_key <> 'screening_dealbreaker'
      ) AS held
    FROM public.candidate_matches m
    LEFT JOIN failing f ON f.m_id = m.id
    WHERE (p_position_id IS NULL OR m.position_id = p_position_id)
      AND (
        m.eligibility_status::text IN ('not_eligible', 'eligible')
        OR EXISTS (SELECT 1 FROM decisions d WHERE d.m_id = m.id AND d.status = 'failed')
      )
    GROUP BY m.id
  LOOP
    next_status := r.before_status;
    why := NULL;
    IF r.recruiter_failed AND r.before_status <> 'not_eligible' THEN
      -- A recruiter's 'failed' wins outright.
      next_status := 'not_eligible';
      why := 'A recruiter decision (recruiter_review) marks this candidate not eligible.';
    ELSIF r.before_status = 'not_eligible' AND cardinality(r.failed) = 0 AND NOT r.held THEN
      -- Wrongly excluded: no failing dealbreaker (after the recruiter's
      -- decisions) and nothing else holding it.
      next_status := CASE WHEN r.recruiter_excepted THEN 'excepted' ELSE 'eligible' END;
      why := CASE WHEN r.recruiter_excepted
        THEN 'A recruiter exception (recruiter_review) lifts the dealbreaker answer; no other dealbreaker answer disqualifies this candidate.'
        ELSE 'No dealbreaker answer disqualifies this candidate; answers to non-dealbreaker questions do not affect eligibility.'
      END;
    END IF;
    -- Excluded (or about to be), but with no record of why: the missing checks.
    missing := cardinality(r.failed) > 0 AND NOT EXISTS (
      SELECT 1 FROM public.eligibility_checks c
      WHERE c.candidate_match_id = r.id AND c.qualifier_key LIKE 'disq:%' AND c.status = 'failed'
    );
    CONTINUE WHEN next_status = r.before_status AND NOT missing;

    IF p_apply THEN
      IF missing THEN
        INSERT INTO public.eligibility_checks
          (candidate_match_id, organization_id, position_id, qualifier_key, qualifier_label, qualifier_kind, status, reason, evidence)
        SELECT r.id, r.org_id, r.pos_id, 'disq:' || (x ->> 'q_id'), x ->> 'question', 'disqualifier', 'failed',
               'Dealbreaker answer: ' || (x ->> 'given'),
               jsonb_build_object('question_id', x ->> 'q_id', 'value', x ->> 'given')
        FROM jsonb_array_elements(r.failed_rows) x
        ON CONFLICT (candidate_match_id, qualifier_key) DO NOTHING;
      END IF;
      IF next_status <> r.before_status THEN
        UPDATE public.candidate_matches
          SET eligibility_status = next_status::public.eligibility_status, eligibility_updated_at = now()
          WHERE id = r.id;
        INSERT INTO public.audit_events (entity_type, entity_id, organization_id, action, before_state, after_state, trace_id)
        VALUES (
          'candidate_match', r.id, r.org_id, 'eligibility_recomputed',
          jsonb_build_object('eligibility_status', r.before_status),
          jsonb_build_object('eligibility_status', next_status, 'reason', why),
          'eligibility-recompute-recruiter-review'
        );
      END IF;
    END IF;
    match_id := r.id; position_id := r.pos_id;
    eligibility_before := r.before_status; eligibility_after := next_status;
    failed_dealbreakers := r.failed; applied := p_apply;
    RETURN NEXT;
  END LOOP;
END;
$fn$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.recompute_screening_eligibility(uuid, boolean) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.recompute_screening_eligibility(uuid, boolean) FROM anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.recompute_screening_eligibility(uuid, boolean) TO service_role;

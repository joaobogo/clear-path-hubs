CREATE TABLE IF NOT EXISTS public.score_reconcile_map_20260826 (
  old_run_id uuid PRIMARY KEY,
  new_run_id uuid NOT NULL,
  old_score numeric,
  new_score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.score_reconcile_map_20260826 TO authenticated;
GRANT ALL ON public.score_reconcile_map_20260826 TO service_role;
ALTER TABLE public.score_reconcile_map_20260826 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read score reconcile map" ON public.score_reconcile_map_20260826;
CREATE POLICY "staff read score reconcile map"
  ON public.score_reconcile_map_20260826 FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));

-- 1. Decide which assessments need a corrected replacement, and reserve ids.
WITH shares AS (
  SELECT sr.id, sr.score,
         LEAST(1, GREATEST(0, (sr.requirement_coverage->>'must_have')::numeric)) AS mh,
         LEAST(1, GREATEST(0, COALESCE((sr.requirement_coverage->>'preferred')::numeric, 0))) AS pr,
         LEAST(1, GREATEST(0, COALESCE((sr.requirement_coverage->>'screening_alignment')::numeric, 0))) AS sa,
         COALESCE((sr.requirement_coverage->'category_weights'->>'must_have')::numeric, 0.6) AS w_mh,
         COALESCE((sr.requirement_coverage->'category_weights'->>'preferred')::numeric, 0.2) AS w_pr,
         COALESCE((sr.requirement_coverage->'category_weights'->>'screening_alignment')::numeric, 0.2) AS w_sa
  FROM public.score_runs sr
  WHERE sr.status = 'completed'
    AND sr.superseded_at IS NULL
    AND sr.requirement_coverage ? 'must_have'
), computed AS (
  SELECT id, score AS old_score,
         ROUND((mh * w_mh + pr * w_pr + sa * w_sa) * 100)::numeric AS total
  FROM shares
)
INSERT INTO public.score_reconcile_map_20260826 (old_run_id, new_run_id, old_score, new_score)
SELECT id, gen_random_uuid(), old_score, total
FROM computed
WHERE old_score IS NULL OR abs(old_score - total) > 1
ON CONFLICT (old_run_id) DO NOTHING;

-- 2. Retire the old assessments first (one current assessment per submission).
UPDATE public.score_runs sr
SET superseded_at = now(),
    superseded_reason = 'Replaced by a corrected assessment: score recomposed from the published weightings'
FROM public.score_reconcile_map_20260826 m
WHERE sr.id = m.old_run_id AND sr.superseded_at IS NULL;

-- 3. Write the corrected assessments.
INSERT INTO public.score_runs (
  id, candidate_match_id, position_id, engine_version, score, confidence, status,
  explanation, evidence, requirement_coverage, started_at, completed_at,
  result, fit_label, must_have_coverage, preferred_coverage,
  contradiction_status, input_hash, is_test_record, application_id,
  candidate_profile_id, candidate_submission_id, organization_id,
  blueprint_version, raw_score, final_score, fit_band, rubric_version_id,
  evaluation_method, evidence_confidence, trace_id
)
SELECT m.new_run_id, t.candidate_match_id, t.position_id, t.engine_version, m.new_score,
       t.confidence, 'completed'::score_status, t.explanation, t.evidence,
       t.requirement_coverage, t.started_at, COALESCE(t.completed_at, now()),
       t.result
         || jsonb_build_object(
              'reconciled_from', t.id::text,
              'reconciliation', jsonb_build_object(
                'method', 'weighted_composition',
                'weights', COALESCE(t.requirement_coverage->'category_weights',
                                    '{"must_have":0.6,"preferred":0.2,"screening_alignment":0.2}'::jsonb),
                'previous_score', m.old_score,
                'total', m.new_score))
         || jsonb_build_object('category_breakdown', jsonb_build_object(
              'must_have', COALESCE((t.requirement_coverage->>'must_have')::numeric, 0),
              'preferred', COALESCE((t.requirement_coverage->>'preferred')::numeric, 0),
              'screening_alignment', COALESCE((t.requirement_coverage->>'screening_alignment')::numeric, 0))),
       CASE WHEN m.new_score >= 70 THEN 'strong_fit'
            WHEN m.new_score >= 50 THEN 'worth_considering'
            ELSE 'not_a_fit' END,
       ROUND(COALESCE((t.requirement_coverage->>'must_have')::numeric, 0), 4),
       ROUND(COALESCE((t.requirement_coverage->>'preferred')::numeric, 0), 4),
       t.contradiction_status, COALESCE(t.input_hash, '') || '-recomposed', t.is_test_record,
       t.application_id, t.candidate_profile_id, t.candidate_submission_id, t.organization_id,
       t.blueprint_version, m.new_score, m.new_score, public.score_band(m.new_score)::text,
       t.rubric_version_id, t.evaluation_method, t.evidence_confidence, t.trace_id
FROM public.score_reconcile_map_20260826 m
JOIN public.score_runs t ON t.id = m.old_run_id
WHERE NOT EXISTS (SELECT 1 FROM public.score_runs x WHERE x.id = m.new_run_id);

-- 4. Point each candidate at the corrected assessment.
UPDATE public.candidate_matches cm
SET approved_score_run_id = m.new_run_id
FROM public.score_reconcile_map_20260826 m
WHERE cm.approved_score_run_id = m.old_run_id;

UPDATE public.candidate_matches cm
SET current_score_run_id = m.new_run_id
FROM public.score_reconcile_map_20260826 m
WHERE cm.current_score_run_id = m.old_run_id;
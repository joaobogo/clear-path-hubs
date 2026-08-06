-- 1) Allow the honest labels: 'legacy' for pre-rubric runs, and a nullable cap.
ALTER TABLE public.score_runs DROP CONSTRAINT IF EXISTS score_runs_evaluation_method_check;
ALTER TABLE public.score_runs ADD CONSTRAINT score_runs_evaluation_method_check
  CHECK (evaluation_method IS NULL OR evaluation_method = ANY (ARRAY[
    'keyword','semantic','hybrid','deterministic_keyword','legacy'
  ]));

-- applied_cap must be able to say "nothing clamped this score". A NOT NULL cap
-- forced it to mirror final_score, which is why the stored triple carried no
-- information (audit finding 11).
ALTER TABLE public.score_runs ALTER COLUMN applied_cap DROP NOT NULL;
ALTER TABLE public.score_runs DROP CONSTRAINT IF EXISTS score_runs_math_ok;
ALTER TABLE public.score_runs ADD CONSTRAINT score_runs_math_ok CHECK (
  raw_score BETWEEN 0 AND 100
  AND final_score BETWEEN 0 AND 100
  AND (applied_cap IS NULL OR (applied_cap BETWEEN 0 AND 100 AND final_score <= applied_cap))
  AND final_score <= raw_score
);

-- 2) Backfill the rubric spine on historical runs.
ALTER TABLE public.score_runs DISABLE TRIGGER score_runs_immutable;

-- 2a) Map each run to the rubric version that governed its position at completion.
UPDATE public.score_runs r
SET rubric_version_id = rv.id
FROM (
  SELECT DISTINCT ON (sr.id) sr.id AS run_id, v.id
  FROM public.score_runs sr
  JOIN public.rubric_versions v ON v.position_id = sr.position_id
  WHERE sr.rubric_version_id IS NULL
    AND v.created_at <= COALESCE(sr.completed_at, sr.started_at, now())
  ORDER BY sr.id, v.created_at DESC
) rv
WHERE r.id = rv.run_id;

-- 2b) Positions whose runs still have no rubric get a synthetic legacy-v0
--     version recording the requirements as they stand, so the criteria list a
--     score was computed against is always renderable.
WITH orphan_positions AS (
  SELECT DISTINCT position_id FROM public.score_runs WHERE rubric_version_id IS NULL
), created AS (
  INSERT INTO public.rubric_versions (
    position_id, organization_id, version_number, status, label,
    dimensions, weights, anchors, qualifiers, snapshot, approved_at
  )
  SELECT
    p.id,
    p.organization_id,
    COALESCE((SELECT MAX(v.version_number) FROM public.rubric_versions v WHERE v.position_id = p.id), 0) + 1,
    'approved',
    'legacy-v0',
    COALESCE(p.requirements, '[]'::jsonb),
    '{}'::jsonb,
    '{}'::jsonb,
    COALESCE(p.preferred_requirements, '[]'::jsonb),
    jsonb_build_object(
      'origin', 'legacy-v0-backfill',
      'reason', 'Reconstructed so historical scores can name their criteria.',
      'position_title', p.title,
      'requirements', COALESCE(p.requirements, '[]'::jsonb),
      'preferred_requirements', COALESCE(p.preferred_requirements, '[]'::jsonb),
      'captured_at', now()
    ),
    now()
  FROM public.positions p
  JOIN orphan_positions o ON o.position_id = p.id
  RETURNING id, position_id
)
UPDATE public.score_runs r
SET rubric_version_id = c.id,
    -- These numbers predate the current deterministic engine contract.
    evaluation_method = 'legacy'
FROM created c
WHERE r.position_id = c.position_id AND r.rubric_version_id IS NULL;

ALTER TABLE public.score_runs ENABLE TRIGGER score_runs_immutable;

-- 3) The spine is now mandatory.
ALTER TABLE public.score_runs ALTER COLUMN rubric_version_id SET NOT NULL;
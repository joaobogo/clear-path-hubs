-- Demo pipeline integrity fix (Northwind Talent demo workspace only)
-- Rollback notes:
--   1) UPDATE candidate_matches SET approved_score_run_id='666d96c4-b783-4112-8faf-ae8f7104fac1',
--      current_score_run_id='666d96c4-b783-4112-8faf-ae8f7104fac1'
--      WHERE id=(SELECT candidate_match_id FROM score_runs WHERE input_hash='c647120b-b03covfix');
--      then clear superseded_* on run d349d87e-... and delete the new '-bandfix' run.
--   2) Stage history timestamps: originals are all '2026-08-13 03:16:48.251334+00'
--      for the 8 ids listed in demo_pipeline_fix_backup_20260813.

CREATE TABLE IF NOT EXISTS public.demo_pipeline_fix_backup_20260813 (
  kind text NOT NULL,
  row_id uuid NOT NULL,
  payload jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, row_id)
);
GRANT ALL ON public.demo_pipeline_fix_backup_20260813 TO service_role;
ALTER TABLE public.demo_pipeline_fix_backup_20260813 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read demo pipeline fix backup" ON public.demo_pipeline_fix_backup_20260813;
CREATE POLICY "staff read demo pipeline fix backup"
  ON public.demo_pipeline_fix_backup_20260813 FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));

INSERT INTO public.demo_pipeline_fix_backup_20260813 (kind, row_id, payload)
SELECT 'stage_history', h.id, to_jsonb(h)
FROM public.candidate_stage_history h
WHERE h.created_at = '2026-08-13 03:16:48.251334+00'
ON CONFLICT DO NOTHING;

INSERT INTO public.demo_pipeline_fix_backup_20260813 (kind, row_id, payload)
SELECT 'score_run', sr.id, to_jsonb(sr)
FROM public.score_runs sr WHERE sr.input_hash = 'c647120b-b03covfix'
ON CONFLICT DO NOTHING;

-- FIX 1: strong_fit requires >=75% must-have coverage; this run has 66.7%.
INSERT INTO public.score_runs (
  candidate_match_id, position_id, engine_version, score, confidence, status, explanation,
  evidence, requirement_coverage, started_at, completed_at, trace_id, result, fit_label,
  must_have_coverage, preferred_coverage, contradiction_status, input_hash, application_id,
  candidate_profile_id, candidate_submission_id, organization_id, blueprint_version,
  raw_score, applied_cap, final_score, fit_band, rubric_version_id, evaluation_method,
  evidence_confidence, cap_reason
)
SELECT candidate_match_id, position_id, 'demo-band-fix-2026-08-13', score, confidence, status,
  explanation, evidence, requirement_coverage, started_at, now(), trace_id, result,
  'worth_considering', must_have_coverage, preferred_coverage, contradiction_status,
  input_hash || '-bandfix', application_id, candidate_profile_id, candidate_submission_id,
  organization_id, blueprint_version, raw_score, applied_cap, final_score,
  'worth_considering', rubric_version_id, evaluation_method, evidence_confidence,
  'strong_fit gate: must-have coverage below 75%'
FROM public.score_runs WHERE input_hash = 'c647120b-b03covfix';

UPDATE public.candidate_matches cm
SET approved_score_run_id = n.id,
    current_score_run_id = n.id
FROM public.score_runs n
WHERE n.input_hash = 'c647120b-b03covfix-bandfix' AND cm.id = n.candidate_match_id;

UPDATE public.score_runs
SET superseded_at = now(),
    superseded_by_run_id = (SELECT id FROM public.score_runs WHERE input_hash = 'c647120b-b03covfix-bandfix'),
    superseded_reason = 'band corrected to match must-have coverage'
WHERE input_hash = 'c647120b-b03covfix';

-- FIX 2: stage history rows shared one timestamp, so the chain read out of order.
ALTER TABLE public.candidate_stage_history DISABLE TRIGGER trg_stage_history_no_update;

UPDATE public.candidate_stage_history SET created_at = '2026-08-13 03:10:00+00' WHERE id = '5b584ff4-e4be-4388-ad22-061cb42828bf'; -- Ana reviewing→delivered
UPDATE public.candidate_stage_history SET created_at = '2026-08-13 03:16:00+00' WHERE id = '534ea800-1c6e-47db-9cca-81083b5a542e'; -- Ana delivered→shortlisted
UPDATE public.candidate_stage_history SET created_at = '2026-08-13 09:40:00+00' WHERE id = '09e156f2-e72f-4550-9e41-059ad7043fe9'; -- Ana shortlisted→interview
UPDATE public.candidate_stage_history SET created_at = '2026-08-13 15:05:00+00' WHERE id = '7a3d3a35-31e1-4eb2-a1c1-948f21406d41'; -- Ana interview→offer
UPDATE public.candidate_stage_history SET created_at = '2026-08-13 08:20:00+00' WHERE id = '9f3e8e42-32e1-47ae-9eb4-44f0afcbd1a5'; -- Beatriz shortlisted→interview
UPDATE public.candidate_stage_history SET created_at = '2026-08-13 13:45:00+00' WHERE id = '45a04af2-b45e-4694-8f91-eb1db1b9c47f'; -- Beatriz interview→offer
UPDATE public.candidate_stage_history SET created_at = '2026-08-13 17:30:00+00' WHERE id = 'c2646e1b-780f-4a46-9a8e-e840d2a79242'; -- Beatriz offer→hired
UPDATE public.candidate_stage_history SET created_at = '2026-08-13 11:15:00+00' WHERE id = '95b76d84-a5e1-4129-a023-2020e44302ab'; -- Miguel reviewing→delivered

ALTER TABLE public.candidate_stage_history ENABLE TRIGGER trg_stage_history_no_update;

UPDATE public.candidate_matches cm
SET current_stage_entered_at = h.created_at
FROM (
  SELECT candidate_match_id, max(created_at) AS created_at
  FROM public.candidate_stage_history GROUP BY candidate_match_id
) h
WHERE h.candidate_match_id = cm.id
  AND cm.organization_id = '0c86fa1b-94ee-46b8-9a11-a42cee39bfed';
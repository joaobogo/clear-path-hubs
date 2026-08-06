-- Calibration lives on the rubric version, so a score run reproduces from its
-- rubric version + its inputs rather than from whatever the code says today.
ALTER TABLE public.rubric_versions
  ADD COLUMN IF NOT EXISTS calibration jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS engine_version text;

-- Backfill existing versions with the v1.1.0 defaults so historical runs replay.
UPDATE public.rubric_versions
SET calibration = jsonb_build_object(
      'calibration_version', 'taasflow-calibration-v1.1.0',
      'engine_version', 'taasflow-scoring-v1.1.0',
      'role_family', NULL,
      'unknown_credit', 0.4,
      'partial_credit', 0.5,
      'met_keyword_ratio', 0.6,
      'met_keyword_floor', 2,
      'keyword_cap', 12,
      'max_evidence_per_requirement', 2,
      'snippet_radius_chars', 80,
      'max_term_hits', 5,
      'negation_sentence_window', 70,
      'negation_bare_window', 25,
      'thin_cv_chars', 300,
      'thin_cv_tokens', 40,
      'unreadable_cv_chars', 60,
      'disqualified_cap', 0.15,
      'base_weights', jsonb_build_object('must_have', 0.6, 'preferred', 0.2, 'screening_alignment', 0.2),
      'confidence_weights', jsonb_build_object('cv_length', 0.4, 'evidence_volume', 0.4, 'screening', 0.2),
      'confidence_cv_length_target', 800,
      'confidence_evidence_floor', 3,
      'confidence_no_screening_default', 0.5,
      'decidedness', jsonb_build_object('met', 1, 'contradicted', 1, 'missing', 0.8, 'partial', 0.6, 'unknown', 0),
      'strong_fit', jsonb_build_object('min_must_have_coverage', 0.75),
      'manual_review_confidence', 0.35
    ),
    engine_version = COALESCE(engine_version, 'taasflow-scoring-v1.1.0')
WHERE calibration = '{}'::jsonb;

-- A published rubric version is immutable: changing any scoring input means
-- creating a new version, never editing one that already governs stored runs.
CREATE OR REPLACE FUNCTION public.tg_rubric_versions_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF OLD.status IN ('approved', 'active') THEN
    IF NEW.calibration IS DISTINCT FROM OLD.calibration
       OR NEW.engine_version IS DISTINCT FROM OLD.engine_version
       OR NEW.dimensions IS DISTINCT FROM OLD.dimensions
       OR NEW.weights IS DISTINCT FROM OLD.weights
       OR NEW.anchors IS DISTINCT FROM OLD.anchors
       OR NEW.qualifiers IS DISTINCT FROM OLD.qualifiers
       OR NEW.position_id IS DISTINCT FROM OLD.position_id
       OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
       OR NEW.version_number IS DISTINCT FROM OLD.version_number
    THEN
      RAISE EXCEPTION 'rubric_version_immutable: create a new rubric version instead of editing % (status %)', OLD.id, OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rubric_versions_immutable ON public.rubric_versions;
CREATE TRIGGER rubric_versions_immutable
  BEFORE UPDATE ON public.rubric_versions
  FOR EACH ROW EXECUTE FUNCTION public.tg_rubric_versions_immutable();
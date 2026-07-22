
-- 1. Processing state enum
DO $$ BEGIN
  CREATE TYPE public.processing_state AS ENUM (
    'queued','parsing','ocr_required','parsed','enriching',
    'ready_to_score','scoring','scored','manual_review_required',
    'provider_blocked','failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Extend candidate_matches
ALTER TABLE public.candidate_matches
  ADD COLUMN IF NOT EXISTS processing_state public.processing_state NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS processing_error_code text,
  ADD COLUMN IF NOT EXISTS processing_error_message text,
  ADD COLUMN IF NOT EXISTS last_processing_trace_id text,
  ADD COLUMN IF NOT EXISTS current_score_run_id uuid REFERENCES public.score_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_score_run_id uuid REFERENCES public.score_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS processing_updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS candidate_matches_processing_state_idx
  ON public.candidate_matches (processing_state, processing_updated_at DESC);

-- 3. Extend score_runs with scoring contract fields
ALTER TABLE public.score_runs
  ADD COLUMN IF NOT EXISTS result jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fit_label text,
  ADD COLUMN IF NOT EXISTS must_have_coverage numeric(5,4),
  ADD COLUMN IF NOT EXISTS preferred_coverage numeric(5,4),
  ADD COLUMN IF NOT EXISTS contradiction_status text,
  ADD COLUMN IF NOT EXISTS input_hash text;

CREATE INDEX IF NOT EXISTS score_runs_input_hash_idx ON public.score_runs (input_hash);

-- 4. Extend files
ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS extracted_text text,
  ADD COLUMN IF NOT EXISTS ocr_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS extraction_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS extraction_attempts int NOT NULL DEFAULT 0;

-- 5. Candidate evidence table (per match, per engine version)
CREATE TABLE IF NOT EXISTS public.candidate_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_match_id uuid NOT NULL REFERENCES public.candidate_matches(id) ON DELETE CASCADE,
  candidate_profile_id uuid NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  cv_file_id uuid REFERENCES public.files(id) ON DELETE SET NULL,
  engine_version text NOT NULL,
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  screening_normalized jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_text_sample text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_match_id, engine_version)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_evidence TO authenticated;
GRANT ALL ON public.candidate_evidence TO service_role;

ALTER TABLE public.candidate_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ce_staff" ON public.candidate_evidence
  FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_platform_staff(auth.uid()));

-- 6. Touch trigger for candidate_matches.processing_updated_at when state changes
CREATE OR REPLACE FUNCTION public.tg_touch_processing_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.processing_state IS DISTINCT FROM OLD.processing_state THEN
    NEW.processing_updated_at = now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS candidate_matches_touch_processing ON public.candidate_matches;
CREATE TRIGGER candidate_matches_touch_processing
BEFORE UPDATE ON public.candidate_matches
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_processing_updated_at();


-- 1) Add score-run identity + math columns
ALTER TABLE public.score_runs
  ADD COLUMN IF NOT EXISTS application_id uuid,
  ADD COLUMN IF NOT EXISTS candidate_profile_id uuid,
  ADD COLUMN IF NOT EXISTS candidate_submission_id uuid,
  ADD COLUMN IF NOT EXISTS organization_id uuid,
  ADD COLUMN IF NOT EXISTS blueprint_version text,
  ADD COLUMN IF NOT EXISTS raw_score numeric(6,2),
  ADD COLUMN IF NOT EXISTS applied_cap numeric(6,2),
  ADD COLUMN IF NOT EXISTS final_score numeric(6,2),
  ADD COLUMN IF NOT EXISTS fit_band text;

-- 2) Backfill existing rows (disable immutability trigger around the UPDATE)
ALTER TABLE public.score_runs DISABLE TRIGGER USER;
UPDATE public.score_runs sr
SET
  application_id          = COALESCE(sr.application_id,
                              NULLIF(sr.result#>>'{identity,application_id}','')::uuid,
                              m.application_id),
  candidate_profile_id    = COALESCE(sr.candidate_profile_id,
                              NULLIF(sr.result#>>'{identity,candidate_profile_id}','')::uuid,
                              m.candidate_profile_id),
  organization_id         = COALESCE(sr.organization_id,
                              NULLIF(sr.result#>>'{identity,organization_id}','')::uuid,
                              m.organization_id),
  candidate_submission_id = COALESCE(sr.candidate_submission_id, m.application_id),
  blueprint_version       = COALESCE(sr.blueprint_version,
                              NULLIF(sr.result->>'blueprint_version',''),
                              'taasflow-blueprint-v1.0.0'),
  raw_score               = COALESCE(sr.raw_score, sr.score, 0),
  applied_cap             = COALESCE(sr.applied_cap, sr.score, 0),
  final_score             = COALESCE(sr.final_score, sr.score, 0),
  fit_band                = COALESCE(sr.fit_band, sr.fit_label, 'not_a_fit')
FROM public.candidate_matches m
WHERE sr.candidate_match_id = m.id;
ALTER TABLE public.score_runs ENABLE TRIGGER USER;

-- 3) NOT NULL
ALTER TABLE public.score_runs
  ALTER COLUMN application_id          SET NOT NULL,
  ALTER COLUMN candidate_profile_id    SET NOT NULL,
  ALTER COLUMN candidate_submission_id SET NOT NULL,
  ALTER COLUMN organization_id         SET NOT NULL,
  ALTER COLUMN blueprint_version       SET NOT NULL,
  ALTER COLUMN raw_score               SET NOT NULL,
  ALTER COLUMN applied_cap             SET NOT NULL,
  ALTER COLUMN final_score             SET NOT NULL,
  ALTER COLUMN fit_band                SET NOT NULL;

-- 4) FKs
ALTER TABLE public.score_runs
  DROP CONSTRAINT IF EXISTS score_runs_application_fk,
  DROP CONSTRAINT IF EXISTS score_runs_candidate_profile_fk,
  DROP CONSTRAINT IF EXISTS score_runs_organization_fk;
ALTER TABLE public.score_runs
  ADD CONSTRAINT score_runs_application_fk
    FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE,
  ADD CONSTRAINT score_runs_candidate_profile_fk
    FOREIGN KEY (candidate_profile_id) REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT score_runs_organization_fk
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 5) Math invariant
ALTER TABLE public.score_runs
  DROP CONSTRAINT IF EXISTS score_runs_math_ok;
ALTER TABLE public.score_runs
  ADD CONSTRAINT score_runs_math_ok
    CHECK (
      raw_score  BETWEEN 0 AND 100
      AND applied_cap BETWEEN 0 AND 100
      AND final_score BETWEEN 0 AND 100
      AND final_score <= applied_cap
      AND final_score <= raw_score
    );

-- 6) Identity trigger
CREATE OR REPLACE FUNCTION public.tg_score_runs_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path='public' AS $fn$
DECLARE m record;
BEGIN
  SELECT position_id, application_id, candidate_profile_id, organization_id
    INTO m FROM public.candidate_matches WHERE id = NEW.candidate_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'score_runs identity: match % not found', NEW.candidate_match_id
      USING ERRCODE='foreign_key_violation';
  END IF;
  IF NEW.position_id IS DISTINCT FROM m.position_id THEN
    RAISE EXCEPTION 'score_runs identity: position mismatch';
  END IF;
  IF NEW.application_id IS DISTINCT FROM m.application_id THEN
    RAISE EXCEPTION 'score_runs identity: application mismatch';
  END IF;
  IF NEW.candidate_profile_id IS DISTINCT FROM m.candidate_profile_id THEN
    RAISE EXCEPTION 'score_runs identity: candidate_profile mismatch';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM m.organization_id THEN
    RAISE EXCEPTION 'score_runs identity: organization mismatch';
  END IF;
  IF NEW.candidate_submission_id IS DISTINCT FROM m.application_id THEN
    RAISE EXCEPTION 'score_runs identity: submission mismatch';
  END IF;
  IF NEW.status = 'completed'::public.score_status THEN
    IF NEW.evidence IS NULL OR jsonb_typeof(NEW.evidence)<>'array' THEN
      RAISE EXCEPTION 'score_runs: completed run must have evidence array';
    END IF;
    IF NEW.blueprint_version IS NULL OR NEW.engine_version IS NULL THEN
      RAISE EXCEPTION 'score_runs: completed run must have blueprint_version and engine_version';
    END IF;
  END IF;
  RETURN NEW;
END $fn$;

-- 7) Reset seeded rows that are visible without an approved run
UPDATE public.candidate_matches
   SET client_visibility='hidden'
 WHERE client_visibility='visible' AND approved_score_run_id IS NULL;

-- 8) Hardened publish gate (INSERT + UPDATE)
CREATE OR REPLACE FUNCTION public.tg_candidate_matches_publish_gate()
RETURNS trigger LANGUAGE plpgsql SET search_path='public' AS $fn$
DECLARE r RECORD;
BEGIN
  IF NEW.client_visibility='visible' AND NEW.approved_score_run_id IS NULL THEN
    RAISE EXCEPTION 'publish gate: cannot mark visible without approved_score_run_id'
      USING ERRCODE='check_violation';
  END IF;
  IF NEW.approved_score_run_id IS NULL THEN RETURN NEW; END IF;

  IF TG_OP='UPDATE'
     AND OLD.approved_score_run_id IS NOT DISTINCT FROM NEW.approved_score_run_id
     AND OLD.client_visibility IS NOT DISTINCT FROM NEW.client_visibility THEN
    RETURN NEW;
  END IF;

  SELECT candidate_match_id, position_id, application_id, candidate_profile_id,
         organization_id, status, evidence, raw_score, applied_cap, final_score
    INTO r FROM public.score_runs WHERE id = NEW.approved_score_run_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'publish gate: approved_score_run_id % not found', NEW.approved_score_run_id
      USING ERRCODE='foreign_key_violation';
  END IF;
  IF r.candidate_match_id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'publish gate: approved run belongs to a different match';
  END IF;
  IF r.position_id IS DISTINCT FROM NEW.position_id
     OR r.application_id IS DISTINCT FROM NEW.application_id
     OR r.candidate_profile_id IS DISTINCT FROM NEW.candidate_profile_id
     OR r.organization_id IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'publish gate: approved run identity mismatch';
  END IF;
  IF r.status IS DISTINCT FROM 'completed'::public.score_status THEN
    RAISE EXCEPTION 'publish gate: approved run status=% (must be completed)', r.status;
  END IF;
  IF r.evidence IS NULL OR jsonb_typeof(r.evidence)<>'array' OR jsonb_array_length(r.evidence)=0 THEN
    RAISE EXCEPTION 'publish gate: approved run has empty evidence';
  END IF;
  IF r.final_score > r.applied_cap OR r.final_score > r.raw_score THEN
    RAISE EXCEPTION 'publish gate: math invariant broken';
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS candidate_matches_publish_gate ON public.candidate_matches;
CREATE TRIGGER candidate_matches_publish_gate
  BEFORE INSERT OR UPDATE ON public.candidate_matches
  FOR EACH ROW EXECUTE FUNCTION public.tg_candidate_matches_publish_gate();

-- 9) Indexes
CREATE INDEX IF NOT EXISTS score_runs_identity_idx
  ON public.score_runs (application_id, position_id, candidate_profile_id);
CREATE INDEX IF NOT EXISTS score_runs_org_idx
  ON public.score_runs (organization_id, completed_at DESC);

-- Positions
ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS publish_ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS attention_reviewed_at timestamptz;

-- Organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS last_client_update_sent_at timestamptz;

-- Candidate matches
ALTER TABLE public.candidate_matches
  ADD COLUMN IF NOT EXISTS submitted_to_client_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_decision_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_stage_entered_at timestamptz;

-- Client decisions
ALTER TABLE public.client_decisions
  ADD COLUMN IF NOT EXISTS recorded_by_staff boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recorded_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Notes
ALTER TABLE public.candidate_notes
  ADD COLUMN IF NOT EXISTS client_shareable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revision_of uuid REFERENCES public.candidate_notes(id) ON DELETE SET NULL;
ALTER TABLE public.internal_notes
  ADD COLUMN IF NOT EXISTS revision_of uuid REFERENCES public.internal_notes(id) ON DELETE SET NULL;

-- Interviews
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

-- Hire records
ALTER TABLE public.hire_records
  ADD COLUMN IF NOT EXISTS start_date_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guarantee_ends_on date;

-- Export jobs
ALTER TABLE public.export_jobs
  ADD COLUMN IF NOT EXISTS requested_scope_hash text;

-- Backfill: current_stage_entered_at from stage history, else updated/created
UPDATE public.candidate_matches m
SET current_stage_entered_at = COALESCE(
  (SELECT max(h.created_at) FROM public.candidate_stage_history h
    WHERE h.candidate_match_id = m.id AND h.to_stage::text = m.stage::text),
  m.updated_at, m.created_at)
WHERE m.current_stage_entered_at IS NULL;

-- Backfill: submitted_to_client_at from stage history entering a client-visible stage
UPDATE public.candidate_matches m
SET submitted_to_client_at = (
  SELECT min(h.created_at) FROM public.candidate_stage_history h
   WHERE h.candidate_match_id = m.id
     AND h.to_stage::text IN ('client_review','shortlisted','submitted','interview','offer','hired'))
WHERE m.submitted_to_client_at IS NULL;

-- Keep current_stage_entered_at fresh
CREATE OR REPLACE FUNCTION public.tg_track_stage_entered_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.current_stage_entered_at := COALESCE(NEW.current_stage_entered_at, now());
  ELSIF NEW.stage::text IS DISTINCT FROM OLD.stage::text THEN
    NEW.current_stage_entered_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_stage_entered_at ON public.candidate_matches;
CREATE TRIGGER trg_track_stage_entered_at
BEFORE INSERT OR UPDATE OF stage ON public.candidate_matches
FOR EACH ROW EXECUTE FUNCTION public.tg_track_stage_entered_at();

CREATE INDEX IF NOT EXISTS candidate_matches_stage_entered_idx
  ON public.candidate_matches (stage, current_stage_entered_at DESC);
CREATE INDEX IF NOT EXISTS candidate_matches_decision_due_idx
  ON public.candidate_matches (client_decision_due_at)
  WHERE client_decision_due_at IS NOT NULL;
-- Record who gave each screening answer.
--
-- A recruiter sometimes fills in a candidate's screening answers from another
-- channel (a call, LinkedIn). Until now such an answer was stored exactly like
-- one the candidate typed, so nothing told staff or the client whose words
-- they were reading. Every answer now says who gave it; a recruiter's entry
-- carries a note of where it came from and stays marked as pending until the
-- candidate answers for themselves.

ALTER TABLE public.application_answers
  ADD COLUMN IF NOT EXISTS answered_by text NOT NULL DEFAULT 'candidate',
  ADD COLUMN IF NOT EXISTS source_note text,
  ADD COLUMN IF NOT EXISTS entered_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS candidate_confirmed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'application_answers_answered_by_check'
      AND conrelid = 'public.application_answers'::regclass
  ) THEN
    ALTER TABLE public.application_answers
      ADD CONSTRAINT application_answers_answered_by_check
      CHECK (answered_by IN ('candidate', 'recruiter_on_behalf'));
  END IF;
  -- A recruiter's entry always says where the answer came from.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'application_answers_recruiter_source_note_check'
      AND conrelid = 'public.application_answers'::regclass
  ) THEN
    ALTER TABLE public.application_answers
      ADD CONSTRAINT application_answers_recruiter_source_note_check
      CHECK (
        answered_by <> 'recruiter_on_behalf'
        OR length(btrim(coalesce(source_note, ''))) >= 8
      );
  END IF;
END $$;

COMMENT ON COLUMN public.application_answers.answered_by IS
  'candidate: the candidate''s own answer. recruiter_on_behalf: entered by staff from another channel, pending the candidate''s confirmation.';
COMMENT ON COLUMN public.application_answers.source_note IS
  'Where a recruiter-entered answer came from. Staff only; never shown to a client or a candidate.';
COMMENT ON COLUMN public.application_answers.candidate_confirmed_at IS
  'When the candidate answered a question a recruiter had answered for them.';

-- The earlier version of an answer, kept when it is replaced: a recruiter's
-- entry the candidate later answers for themselves, or a recruiter's entry the
-- recruiter corrects. Written by the server only.
CREATE TABLE IF NOT EXISTS public.application_answer_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  question_id uuid NOT NULL,
  question text,
  answer jsonb,
  answered_by text NOT NULL CHECK (answered_by IN ('candidate', 'recruiter_on_behalf')),
  source_note text,
  entered_by_user_id uuid,
  answered_at timestamptz,
  replaced_at timestamptz NOT NULL DEFAULT now(),
  replaced_by text NOT NULL CHECK (replaced_by IN ('candidate', 'recruiter_on_behalf')),
  answer_changed boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS application_answer_history_application_idx
  ON public.application_answer_history (application_id, question_id, replaced_at DESC);

ALTER TABLE public.application_answer_history ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.application_answer_history FROM anon, authenticated;
GRANT SELECT ON public.application_answer_history TO authenticated;
GRANT ALL ON public.application_answer_history TO service_role;

DROP POLICY IF EXISTS "staff read answer history" ON public.application_answer_history;
CREATE POLICY "staff read answer history"
  ON public.application_answer_history
  FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));

-- Publishing with recruiter-entered answers is a decision a recruiter makes
-- on purpose. The acknowledgement lives on the match, and the check sits on
-- the write that makes a match visible, so every publish route passes it.
ALTER TABLE public.candidate_matches
  ADD COLUMN IF NOT EXISTS recruiter_answers_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS recruiter_answers_confirmed_by uuid;

CREATE OR REPLACE FUNCTION public.tg_candidate_matches_recruiter_answers_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_latest timestamptz;
BEGIN
  IF NEW.client_visibility::text = 'visible'
     AND OLD.client_visibility::text IS DISTINCT FROM 'visible'
     AND NEW.application_id IS NOT NULL THEN
    SELECT max(greatest(a.created_at, a.updated_at))
      INTO v_latest
      FROM public.application_answers a
     WHERE a.application_id = NEW.application_id
       AND a.answered_by = 'recruiter_on_behalf'
       AND a.candidate_confirmed_at IS NULL;
    IF v_latest IS NOT NULL
       AND (NEW.recruiter_answers_confirmed_at IS NULL
            OR NEW.recruiter_answers_confirmed_at < v_latest) THEN
      RAISE EXCEPTION 'recruiter_answers_unconfirmed'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.tg_candidate_matches_recruiter_answers_gate() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS candidate_matches_recruiter_answers_gate ON public.candidate_matches;
CREATE TRIGGER candidate_matches_recruiter_answers_gate
  BEFORE UPDATE OF client_visibility ON public.candidate_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_candidate_matches_recruiter_answers_gate();

-- The acknowledgement is a staff decision: add it to the columns only staff
-- may write (the list is otherwise unchanged).
DROP TRIGGER IF EXISTS trg_candidate_matches_staff_columns ON public.candidate_matches;
CREATE TRIGGER trg_candidate_matches_staff_columns
  BEFORE UPDATE ON public.candidate_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_staff_only_columns(
    'admin_status', 'client_visibility', 'canonical_state', 'eligibility_status',
    'eligibility_updated_at', 'evidence_confidence', 'recommendation',
    'recommendation_reason', 'recommendation_updated_at', 'integrity_status',
    'contact_released_at', 'contact_released_by', 'contact_release_reason',
    'current_score_run_id', 'approved_score_run_id', 'processing_state',
    'processing_error_code', 'processing_error_message', 'last_processing_trace_id',
    'organization_id', 'position_id', 'candidate_profile_id', 'application_id',
    'is_test_record', 'test_run_id', 'delivered_at', 'submitted_to_client_at',
    'expires_at', 'intro_video_url', 'intro_video_added_by', 'intro_video_added_at',
    'recruiter_answers_confirmed_at', 'recruiter_answers_confirmed_by'
  );

-- Daniel Miles's five answers on the UK & Ireland role were entered by a
-- recruiter on 26 Nov 2026 through the candidate's status page. Their content
-- is not touched; only who gave them is recorded.
UPDATE public.application_answers a
   SET answered_by = 'recruiter_on_behalf',
       source_note = 'Entered by John from LinkedIn and a separate channel, 26 Nov 2026',
       entered_by_user_id = 'e60fd0fc-3f4d-4911-b469-c672ca0ca369'
  FROM public.candidate_matches m
 WHERE m.id = '9f0c4c00-f8ea-423b-87a5-b40e443a99ac'
   AND a.application_id = m.application_id
   AND a.answered_by = 'candidate'
   AND a.created_at >= '2026-11-26 16:00:00+00'
   AND a.created_at <  '2026-11-26 17:00:00+00';

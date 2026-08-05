-- Structured recruiter notes: required type, client-shareable flag, revisions.

ALTER TABLE public.candidate_notes
  ADD COLUMN IF NOT EXISTS note_type text,
  ADD COLUMN IF NOT EXISTS revision_group_id uuid,
  ADD COLUMN IF NOT EXISTS revision_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

UPDATE public.candidate_notes SET note_type = 'screening' WHERE note_type IS NULL;
UPDATE public.candidate_notes SET revision_group_id = id WHERE revision_group_id IS NULL;

ALTER TABLE public.candidate_notes
  ALTER COLUMN note_type SET NOT NULL,
  ALTER COLUMN note_type SET DEFAULT 'screening',
  ALTER COLUMN revision_group_id SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.candidate_notes
    ADD CONSTRAINT candidate_notes_note_type_check
    CHECK (note_type = ANY (ARRAY['screening','client_feedback','risk','logistics']));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS candidate_notes_revision_idx
  ON public.candidate_notes (revision_group_id, revision_number DESC);

ALTER TABLE public.internal_notes
  ADD COLUMN IF NOT EXISTS note_type text,
  ADD COLUMN IF NOT EXISTS client_shareable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revision_group_id uuid,
  ADD COLUMN IF NOT EXISTS revision_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

UPDATE public.internal_notes
SET note_type = CASE
  WHEN kind = 'risk' THEN 'risk'
  WHEN kind = 'handoff' THEN 'logistics'
  WHEN kind = 'decision' THEN 'client_feedback'
  ELSE 'screening'
END
WHERE note_type IS NULL;
UPDATE public.internal_notes SET revision_group_id = id WHERE revision_group_id IS NULL;

ALTER TABLE public.internal_notes
  ALTER COLUMN note_type SET NOT NULL,
  ALTER COLUMN note_type SET DEFAULT 'screening',
  ALTER COLUMN revision_group_id SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.internal_notes
    ADD CONSTRAINT internal_notes_note_type_check
    CHECK (note_type = ANY (ARRAY['screening','client_feedback','risk','logistics']));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS internal_notes_revision_idx
  ON public.internal_notes (revision_group_id, revision_number DESC);
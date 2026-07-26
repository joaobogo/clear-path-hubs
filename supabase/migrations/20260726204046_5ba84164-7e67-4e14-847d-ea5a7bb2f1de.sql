-- Document pipeline: explicit parse state machine + provenance on files.
ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS parse_state text NOT NULL DEFAULT 'uploaded',
  ADD COLUMN IF NOT EXISTS parse_error_code text,
  ADD COLUMN IF NOT EXISTS parse_error text,
  ADD COLUMN IF NOT EXISTS parse_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS parser text,
  ADD COLUMN IF NOT EXISTS parser_version text,
  ADD COLUMN IF NOT EXISTS page_count integer,
  ADD COLUMN IF NOT EXISTS upload_source text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'files_parse_state_chk'
  ) THEN
    ALTER TABLE public.files
      ADD CONSTRAINT files_parse_state_chk CHECK (parse_state IN
        ('uploading','uploaded','queued','parsing','parsed','review_required','failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS files_parse_state_idx ON public.files (parse_state)
  WHERE parse_state IN ('queued','parsing','review_required','failed');

-- Backfill existing rows so previously working PDFs keep a sane state.
UPDATE public.files
   SET parse_state = CASE
     WHEN extracted_text IS NOT NULL AND length(extracted_text) >= 60 THEN 'parsed'
     WHEN file_status = 'failed' THEN 'failed'
     ELSE 'uploaded'
   END
 WHERE parse_state = 'uploaded';
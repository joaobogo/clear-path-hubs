ALTER TABLE public.export_jobs
  ADD COLUMN IF NOT EXISTS contact_included boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_omission_reason text,
  ADD COLUMN IF NOT EXISTS scope_label text,
  ADD COLUMN IF NOT EXISTS storage_bucket text,
  ADD COLUMN IF NOT EXISTS storage_path text;

GRANT SELECT, INSERT ON public.export_jobs TO authenticated;
GRANT ALL ON public.export_jobs TO service_role;
ALTER TABLE public.saved_views ADD COLUMN IF NOT EXISTS last_used_at timestamptz;
CREATE INDEX IF NOT EXISTS saved_views_last_used_idx ON public.saved_views (surface, last_used_at DESC NULLS LAST);
ALTER TABLE public.candidate_profiles
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS website_url text;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS cover_letter text,
  ADD COLUMN IF NOT EXISTS portfolio_url text,
  ADD COLUMN IF NOT EXISTS accommodation_request text,
  ADD COLUMN IF NOT EXISTS question_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS consent jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.applications.accommodation_request IS 'Private accessibility/accommodation request. Never expose to client-facing views or exports.';
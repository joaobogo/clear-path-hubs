ALTER TABLE public.candidate_profiles
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS years_experience integer;

ALTER TABLE public.candidate_profiles
  DROP CONSTRAINT IF EXISTS candidate_profiles_years_experience_ck;
ALTER TABLE public.candidate_profiles
  ADD CONSTRAINT candidate_profiles_years_experience_ck
  CHECK (years_experience IS NULL OR (years_experience >= 0 AND years_experience <= 80));
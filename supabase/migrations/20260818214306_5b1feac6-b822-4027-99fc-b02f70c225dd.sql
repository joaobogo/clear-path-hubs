BEGIN;

-- Add org-type facet flags with safe defaults.
ALTER TABLE public.organizations
  ADD COLUMN is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN is_qa boolean NOT NULL DEFAULT false,
  ADD COLUMN is_internal boolean NOT NULL DEFAULT false;

-- Classify existing orgs by name patterns.
UPDATE public.organizations SET is_demo = true
  WHERE name ILIKE '%(Demo)%' OR name ILIKE '%(Empty Demo)%';

UPDATE public.organizations SET is_qa = true
  WHERE name ILIKE 'QA_%' OR name ILIKE '%Rehearsal%' OR name ILIKE '%Test Company%';

UPDATE public.organizations SET is_internal = true
  WHERE name ILIKE 'TaaSFlow%' OR name ILIKE 'taasflow%';

-- Demos are real demo accounts, not QA fixtures; QA and internal are test fixtures.
UPDATE public.organizations SET is_test_record = false WHERE is_demo = true;
UPDATE public.organizations SET is_test_record = true WHERE is_qa = true OR is_internal = true;

-- Canonicalize the industry taxonomy so filtering one variant does not miss the other.
UPDATE public.organizations
  SET industry = 'Architecture, Engineering, and Construction (AEC)'
  WHERE industry = 'Architecture, Engineering, and Construction (A/E/C)';

UPDATE public.organizations
  SET industry = 'Technology'
  WHERE industry = 'technology';

COMMIT;
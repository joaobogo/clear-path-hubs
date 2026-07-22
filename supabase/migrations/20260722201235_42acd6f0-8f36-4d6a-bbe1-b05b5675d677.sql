
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS primary_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS primary_contact_email TEXT,
  ADD COLUMN IF NOT EXISTS locations TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_status TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS dashboard_status TEXT NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_onboarding_status_check') THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_onboarding_status_check
      CHECK (onboarding_status IN ('not_started','in_progress','live','on_hold'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_dashboard_status_check') THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_dashboard_status_check
      CHECK (dashboard_status IN ('inactive','active','maintenance'));
  END IF;
END $$;

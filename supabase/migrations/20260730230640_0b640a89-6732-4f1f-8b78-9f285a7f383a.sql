ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS plan_name text,
  ADD COLUMN IF NOT EXISTS billing_interval text,
  ADD COLUMN IF NOT EXISTS billing_period_start date,
  ADD COLUMN IF NOT EXISTS billing_period_end date,
  ADD COLUMN IF NOT EXISTS renewal_date date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_billing_interval_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_billing_interval_check
      CHECK (billing_interval IS NULL OR billing_interval IN ('monthly','quarterly','annual'));
  END IF;
END $$;

COMMENT ON COLUMN public.organizations.plan_name IS 'Subscription plan name shown on the account page. NULL = not on file.';
COMMENT ON COLUMN public.organizations.renewal_date IS 'Next renewal date shown on the account page. NULL = not on file.';
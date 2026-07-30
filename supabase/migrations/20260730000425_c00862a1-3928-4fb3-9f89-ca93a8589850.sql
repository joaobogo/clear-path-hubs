ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS pilot_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS pilot_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pilot_admin_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pilot_override_reason text,
  ADD COLUMN IF NOT EXISTS pilot_override_by uuid,
  ADD COLUMN IF NOT EXISTS pilot_override_at timestamptz;

-- Backfill: any organization that already started a pilot has used it.
UPDATE public.organizations
   SET pilot_used = true
 WHERE pilot_used = false
   AND pilot_status IS NOT NULL
   AND pilot_status <> 'none'
   AND pilot_started_at IS NOT NULL;

ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS channel_plan jsonb,
  ADD COLUMN IF NOT EXISTS search_live_at timestamptz,
  ADD COLUMN IF NOT EXISTS search_live_email_at timestamptz;

COMMENT ON COLUMN public.organizations.pilot_used IS 'True once the one-time introductory pilot has been consumed by this company. Admin override is the only way to grant another.';
COMMENT ON COLUMN public.positions.channel_plan IS 'Sourcing channel plan: [{key,label,state}] where state is recommended|planned|configuring|active|paused|completed|unavailable. Never set to active without a real backend activation.';
COMMENT ON COLUMN public.positions.search_live_at IS 'Set when the search actually goes live. Gates the search-live client email.';
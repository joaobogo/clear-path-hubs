ALTER TYPE public.hire_status ADD VALUE IF NOT EXISTS 'offer_negotiating' AFTER 'offer_sent';
ALTER TABLE public.hire_records ADD COLUMN IF NOT EXISTS negotiating_at timestamptz;
ALTER TABLE public.hire_records ADD COLUMN IF NOT EXISTS last_nudged_at timestamptz;
ALTER TABLE public.hire_records ADD COLUMN IF NOT EXISTS nudge_count integer NOT NULL DEFAULT 0;
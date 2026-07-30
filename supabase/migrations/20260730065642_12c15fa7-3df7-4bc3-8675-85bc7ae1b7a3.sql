ALTER TABLE public.crm_submission_queue
  ADD COLUMN IF NOT EXISTS conversion_page text,
  ADD COLUMN IF NOT EXISTS first_touch_source text,
  ADD COLUMN IF NOT EXISTS first_touch_medium text,
  ADD COLUMN IF NOT EXISTS first_touch_campaign text,
  ADD COLUMN IF NOT EXISTS last_touch_source text,
  ADD COLUMN IF NOT EXISTS last_touch_medium text,
  ADD COLUMN IF NOT EXISTS last_touch_campaign text,
  ADD COLUMN IF NOT EXISTS gclid text,
  ADD COLUMN IF NOT EXISTS gbraid text,
  ADD COLUMN IF NOT EXISTS wbraid text,
  ADD COLUMN IF NOT EXISTS msclkid text,
  ADD COLUMN IF NOT EXISTS linkedin_click_id text,
  ADD COLUMN IF NOT EXISTS fgv_journey_id text,
  ADD COLUMN IF NOT EXISTS fgv_entry_brand text,
  ADD COLUMN IF NOT EXISTS fgv_referrer text,
  ADD COLUMN IF NOT EXISTS first_landing_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS service_interest text,
  ADD COLUMN IF NOT EXISTS secondary_service_interest text,
  ADD COLUMN IF NOT EXISTS destination_brand text,
  ADD COLUMN IF NOT EXISTS lead_type text,
  ADD COLUMN IF NOT EXISTS cross_sell_status text,
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS crm_submission_queue_journey_idx
  ON public.crm_submission_queue (fgv_journey_id);
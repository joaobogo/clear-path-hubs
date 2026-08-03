ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS landing_page text,
  ADD COLUMN IF NOT EXISTS referrer text,
  ADD COLUMN IF NOT EXISTS privacy_acknowledged boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS contact_messages_utm_campaign_idx
  ON public.contact_messages (utm_campaign);
CREATE INDEX IF NOT EXISTS contact_messages_utm_source_idx
  ON public.contact_messages (utm_source);
ALTER TABLE public.marketing_inquiries
  ADD COLUMN IF NOT EXISTS vertical_slug text,
  ADD COLUMN IF NOT EXISTS seniority text,
  ADD COLUMN IF NOT EXISTS volume text,
  ADD COLUMN IF NOT EXISTS urgency text,
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS lead_score integer,
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS owner_desk text,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS first_response_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS responded_by uuid,
  ADD COLUMN IF NOT EXISTS suggested_first_message text,
  ADD COLUMN IF NOT EXISTS prefill_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS prefill_used_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS marketing_inquiries_prefill_token_key
  ON public.marketing_inquiries (prefill_token);

CREATE INDEX IF NOT EXISTS marketing_inquiries_queue_idx
  ON public.marketing_inquiries (first_responded_at, first_response_due_at);

CREATE INDEX IF NOT EXISTS marketing_inquiries_vertical_idx
  ON public.marketing_inquiries (vertical_slug);

UPDATE public.marketing_inquiries
SET vertical_slug = COALESCE(vertical_slug, industry_slug)
WHERE vertical_slug IS NULL;
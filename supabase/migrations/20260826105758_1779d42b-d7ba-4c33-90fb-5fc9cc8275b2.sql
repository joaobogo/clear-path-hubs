ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS confirmation_email_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS confirmation_email_error_code text,
  ADD COLUMN IF NOT EXISTS confirmation_email_error_message text,
  ADD COLUMN IF NOT EXISTS confirmation_email_attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confirmation_email_last_attempt_at timestamp with time zone;

UPDATE public.applications
SET confirmation_email_status = 'sent'
WHERE confirmation_email_sent_at IS NOT NULL
  AND confirmation_email_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_applications_confirmation_email_status_attempt
  ON public.applications (confirmation_email_status, confirmation_email_last_attempt_at DESC)
  WHERE confirmation_email_status IN ('failed', 'suppressed');
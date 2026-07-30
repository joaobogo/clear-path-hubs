CREATE TABLE public.crm_submission_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL UNIQUE,
  source_brand text NOT NULL,
  source_website text NOT NULL,
  source_domain text NOT NULL,
  environment text NOT NULL DEFAULT 'production',
  source_form_id text NOT NULL,
  source_form_name text NOT NULL,
  form_type text NOT NULL,
  source_page_url text,
  source_page_title text,
  landing_page text,
  original_referrer text,
  latest_referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  email text NOT NULL,
  full_name text,
  phone text,
  job_title text,
  linkedin text,
  company_name text,
  company_domain text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent_status text,
  consent_at timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  attio_person_id text,
  attio_company_id text,
  attio_deal_id text,
  attio_note_id text,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_submission_queue_status_check CHECK (status IN ('pending','synced','failed','skipped'))
);

CREATE INDEX crm_submission_queue_status_idx ON public.crm_submission_queue (status, created_at);

GRANT ALL ON public.crm_submission_queue TO service_role;

ALTER TABLE public.crm_submission_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_queue_service_role_only"
  ON public.crm_submission_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.crm_queue_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_crm_submission_queue_updated_at
  BEFORE UPDATE ON public.crm_submission_queue
  FOR EACH ROW EXECUTE FUNCTION public.crm_queue_touch_updated_at();
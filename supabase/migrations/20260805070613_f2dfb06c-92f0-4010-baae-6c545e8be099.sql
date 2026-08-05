ALTER TABLE public.hire_records
  ADD COLUMN IF NOT EXISTS expected_response_date date,
  ADD COLUMN IF NOT EXISTS expected_response_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS expected_response_set_by uuid;

COMMENT ON COLUMN public.hire_records.expected_response_date IS 'Agreed date by which a response to the offer is expected. Never inferred; null means no date was agreed.';
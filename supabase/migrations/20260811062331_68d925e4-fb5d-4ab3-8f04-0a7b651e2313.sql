ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_client_seat_limit_range;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_client_seat_limit_range
  CHECK (client_seat_limit >= 0 AND client_seat_limit <= 50);
-- 1. Enum
CREATE TYPE public.payment_status AS ENUM ('unpaid', 'pending', 'paid', 'refunded', 'exempt');

-- 2. Payments table
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'stripe',
  provider_environment text NOT NULL DEFAULT 'sandbox',
  provider_reference text,
  provider_customer_id text,
  price_id text,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'usd',
  status public.payment_status NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  webhook_event_id text,
  raw_event jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX payments_webhook_event_id_key
  ON public.payments (webhook_event_id) WHERE webhook_event_id IS NOT NULL;
CREATE UNIQUE INDEX payments_provider_reference_key
  ON public.payments (provider, provider_environment, provider_reference)
  WHERE provider_reference IS NOT NULL;
CREATE INDEX payments_organization_id_idx ON public.payments (organization_id);
CREATE INDEX payments_position_id_idx ON public.payments (position_id);

-- 3. Grants
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

-- 4. RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read own payments"
  ON public.payments FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Platform staff read all payments"
  ON public.payments FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));

CREATE POLICY "Service role manages payments"
  ON public.payments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 5. updated_at trigger
CREATE OR REPLACE FUNCTION public.payments_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER payments_set_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.payments_touch_updated_at();

-- 6. positions.payment_status
ALTER TABLE public.positions
  ADD COLUMN payment_status public.payment_status NOT NULL DEFAULT 'unpaid';

-- 7. Backfill pre-payment history honestly as exempt
UPDATE public.positions SET payment_status = 'exempt';

CREATE INDEX positions_payment_status_idx ON public.positions (payment_status);
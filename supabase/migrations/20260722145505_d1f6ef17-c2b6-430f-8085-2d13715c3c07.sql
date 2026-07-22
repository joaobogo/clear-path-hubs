
CREATE TABLE public.provider_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('lovable_ai','email','storage','ocr','enrichment')),
  operation text NOT NULL CHECK (operation IN ('cv_parse','ocr','enrichment','score','rescore','notification','email')),
  entity_type text,
  entity_id uuid,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  tokens_in integer,
  tokens_out integer,
  bytes integer,
  cost_estimate_micros bigint,
  latency_ms integer,
  success boolean NOT NULL DEFAULT true,
  error_code text,
  trace_id text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX provider_usage_time_idx ON public.provider_usage_events(occurred_at DESC);
CREATE INDEX provider_usage_op_idx ON public.provider_usage_events(operation, occurred_at DESC);
CREATE INDEX provider_usage_entity_idx ON public.provider_usage_events(entity_type, entity_id);

GRANT SELECT ON public.provider_usage_events TO authenticated;
GRANT ALL ON public.provider_usage_events TO service_role;
ALTER TABLE public.provider_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider_usage_staff_only" ON public.provider_usage_events FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));

CREATE TABLE public.cost_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation text NOT NULL UNIQUE CHECK (operation IN ('cv_parse','ocr','enrichment','score','rescore','notification','email')),
  per_entity_daily_cap integer NOT NULL,
  per_org_daily_cap integer NOT NULL,
  per_platform_hourly_cap integer NOT NULL,
  max_bytes_per_op integer,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cost_limits TO authenticated;
GRANT ALL ON public.cost_limits TO service_role;
ALTER TABLE public.cost_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cost_limits_read_staff" ON public.cost_limits FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));
CREATE POLICY "cost_limits_write_staff" ON public.cost_limits FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));

INSERT INTO public.cost_limits (operation, per_entity_daily_cap, per_org_daily_cap, per_platform_hourly_cap, max_bytes_per_op, notes) VALUES
  ('cv_parse',     3,   200,  2000, 10485760, 'Idempotent per file hash; caps prevent repeat parsing of the same CV.'),
  ('ocr',          2,   100,  1000, 20971520, 'Only invoked when PDF text layer is empty.'),
  ('enrichment',   1,    50,   500,     NULL, 'Once per profile per 30 days; retry cap 1.'),
  ('score',        5,   500,  5000,     NULL, 'Applies per candidate per position per day.'),
  ('rescore',      2,   200,  1000,     NULL, 'Requires reason; blocked if evidence hash unchanged.'),
  ('notification', 50, 5000, 20000,     NULL, 'Per-user per day.'),
  ('email',        20, 2000, 10000,     NULL, 'Per-recipient per day; excludes transactional receipts.');

INSERT INTO public.retention_policies (data_class, entity, retention_days, action, legal_basis, notes)
VALUES ('provider_usage','provider_usage_events',180,'delete','legitimate_interest','Cost/telemetry rows retained 180 days; aggregates rolled up to monthly summary.')
ON CONFLICT (data_class) DO NOTHING;

CREATE TRIGGER cost_limits_touch BEFORE UPDATE ON public.cost_limits
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

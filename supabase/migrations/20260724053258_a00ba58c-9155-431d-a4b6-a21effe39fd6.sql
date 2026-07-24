
CREATE TABLE public.business_rules_overrides (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  notes TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_rules_overrides TO authenticated;
GRANT ALL ON public.business_rules_overrides TO service_role;

ALTER TABLE public.business_rules_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admin_read_overrides"
  ON public.business_rules_overrides FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform_admin_write_overrides"
  ON public.business_rules_overrides FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE TRIGGER trg_business_rules_overrides_touch
  BEFORE UPDATE ON public.business_rules_overrides
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE public.business_rules_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  actor_user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('create','update','delete','reset')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_business_rules_audit_key_created
  ON public.business_rules_audit (key, created_at DESC);

GRANT SELECT, INSERT ON public.business_rules_audit TO authenticated;
GRANT ALL ON public.business_rules_audit TO service_role;

ALTER TABLE public.business_rules_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admin_read_business_rules_audit"
  ON public.business_rules_audit FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform_admin_insert_business_rules_audit"
  ON public.business_rules_audit FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

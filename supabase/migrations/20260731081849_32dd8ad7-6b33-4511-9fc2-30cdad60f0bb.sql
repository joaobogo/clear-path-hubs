CREATE TABLE public.dashboard_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  source text NOT NULL CHECK (source IN ('subscription','staff','addon')),
  note text,
  granted_by uuid,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dashboard_grants_org_idx ON public.dashboard_grants(organization_id, status);

CREATE TABLE public.dashboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dashboards_org_idx ON public.dashboards(organization_id);
CREATE UNIQUE INDEX dashboards_one_default_per_org ON public.dashboards(organization_id) WHERE is_default;

CREATE TABLE public.dashboard_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by uuid,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','quoted','agreed','delivered','declined','cancelled')),
  quote_amount_cents integer,
  quote_currency text NOT NULL DEFAULT 'gbp',
  quote_note text,
  quoted_by uuid,
  quoted_at timestamptz,
  delivered_dashboard_id uuid REFERENCES public.dashboards(id) ON DELETE SET NULL,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dashboard_requests_org_idx ON public.dashboard_requests(organization_id, status);

CREATE TABLE public.dashboard_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  dashboard_id uuid NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
  format text NOT NULL CHECK (format IN ('pdf','csv')),
  cadence text NOT NULL CHECK (cadence IN ('on_demand','weekly')),
  recipients text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dashboard_deliveries_org_idx ON public.dashboard_deliveries(organization_id, active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_deliveries TO authenticated;
GRANT SELECT ON public.dashboard_grants TO authenticated;
GRANT ALL ON public.dashboard_grants TO service_role;
GRANT ALL ON public.dashboards TO service_role;
GRANT ALL ON public.dashboard_requests TO service_role;
GRANT ALL ON public.dashboard_deliveries TO service_role;

ALTER TABLE public.dashboard_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY dashboard_grants_read ON public.dashboard_grants FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));
CREATE POLICY dashboard_grants_staff_write ON public.dashboard_grants FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));

CREATE POLICY dashboards_read ON public.dashboards FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));
CREATE POLICY dashboards_write ON public.dashboards FOR ALL TO authenticated
  USING (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY dashboard_requests_read ON public.dashboard_requests FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));
CREATE POLICY dashboard_requests_client_insert ON public.dashboard_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));
CREATE POLICY dashboard_requests_staff_write ON public.dashboard_requests FOR UPDATE TO authenticated
  USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));
CREATE POLICY dashboard_requests_staff_delete ON public.dashboard_requests FOR DELETE TO authenticated
  USING (public.is_platform_staff(auth.uid()));

CREATE POLICY dashboard_deliveries_read ON public.dashboard_deliveries FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));
CREATE POLICY dashboard_deliveries_write ON public.dashboard_deliveries FOR ALL TO authenticated
  USING (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE TRIGGER dashboards_updated_at BEFORE UPDATE ON public.dashboards
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER dashboard_grants_updated_at BEFORE UPDATE ON public.dashboard_grants
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER dashboard_requests_updated_at BEFORE UPDATE ON public.dashboard_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER dashboard_deliveries_updated_at BEFORE UPDATE ON public.dashboard_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
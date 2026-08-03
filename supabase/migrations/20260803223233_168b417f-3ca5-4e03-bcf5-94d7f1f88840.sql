CREATE TABLE public.integration_health_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration text NOT NULL CHECK (integration IN ('stripe','attio','calendly','email')),
  status text NOT NULL CHECK (status IN ('ok','degraded','failed','not_configured')),
  summary text NOT NULL,
  error_code text,
  error_detail text,
  remediation text,
  latency_ms integer,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_health_latest ON public.integration_health_checks (integration, created_at DESC);

GRANT SELECT ON public.integration_health_checks TO authenticated;
GRANT ALL ON public.integration_health_checks TO service_role;

ALTER TABLE public.integration_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform staff can read integration health checks"
ON public.integration_health_checks
FOR SELECT
TO authenticated
USING (public.is_platform_staff(auth.uid()));
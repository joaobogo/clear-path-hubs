
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS candidate_profiles_full_name_trgm ON public.candidate_profiles USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS candidate_profiles_email_trgm ON public.candidate_profiles USING gin ((email::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS candidate_profiles_phone_trgm ON public.candidate_profiles USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS positions_title_trgm ON public.positions USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS organizations_name_trgm ON public.organizations USING gin (name gin_trgm_ops);

CREATE TABLE public.saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surface text NOT NULL CHECK (surface IN (
    'admin_candidates','admin_positions','admin_intakes','admin_processing',
    'admin_matches','admin_activity','admin_privacy',
    'client_positions','client_candidates','client_messages'
  )),
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_shared boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, surface, name)
);
CREATE INDEX saved_views_owner_idx ON public.saved_views(user_id, surface);
CREATE INDEX saved_views_org_idx ON public.saved_views(organization_id, surface) WHERE is_shared;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_views TO authenticated;
GRANT ALL ON public.saved_views TO service_role;
ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_views_read" ON public.saved_views FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_platform_staff(auth.uid())
    OR (is_shared AND organization_id IS NOT NULL AND public.is_org_viewer(auth.uid(), organization_id))
  );
CREATE POLICY "saved_views_insert" ON public.saved_views FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "saved_views_update" ON public.saved_views FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "saved_views_delete" ON public.saved_views FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER saved_views_touch BEFORE UPDATE ON public.saved_views
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE public.export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  export_type text NOT NULL CHECK (export_type IN (
    'admin_position_pipeline','admin_candidate_list','admin_processing_failures','admin_audit_activity',
    'client_candidate_shortlist','client_position_summary','client_candidate_one_pager'
  )),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_count integer,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed','expired')),
  output_file_id uuid REFERENCES public.files(id) ON DELETE SET NULL,
  data_freshness_at timestamptz,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz,
  error text,
  trace_id text
);
CREATE INDEX export_jobs_requester_idx ON public.export_jobs(requested_by, requested_at DESC);
CREATE INDEX export_jobs_org_idx ON public.export_jobs(organization_id, requested_at DESC);

GRANT SELECT, INSERT ON public.export_jobs TO authenticated;
GRANT ALL ON public.export_jobs TO service_role;
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "export_jobs_read" ON public.export_jobs FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.is_platform_staff(auth.uid())
    OR (organization_id IS NOT NULL AND public.is_org_admin(auth.uid(), organization_id))
  );
CREATE POLICY "export_jobs_insert" ON public.export_jobs FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

INSERT INTO public.retention_policies (data_class, entity, retention_days, action, legal_basis, notes)
VALUES ('export_jobs','export_jobs',90,'delete','legitimate_interest','Export audit trail retained 90 days; output files expire per bucket lifecycle.')
ON CONFLICT (data_class) DO NOTHING;

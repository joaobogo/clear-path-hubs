
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE public.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id uuid REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  subject_email citext,
  consent_type text NOT NULL CHECK (consent_type IN (
    'application_specific_role','future_role_consideration','talent_network',
    'email_notifications','profile_reuse','optional_enrichment'
  )),
  granted boolean NOT NULL,
  policy_version text NOT NULL,
  source text NOT NULL CHECK (source IN ('apply_form','profile_settings','admin_action','import')),
  ip_address inet,
  user_agent text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  granted_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consent_records_profile_idx ON public.consent_records(candidate_profile_id, consent_type, granted_at DESC);
CREATE INDEX consent_records_email_idx ON public.consent_records(subject_email);
GRANT SELECT, INSERT, UPDATE ON public.consent_records TO authenticated;
GRANT ALL ON public.consent_records TO service_role;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consent_own_read" ON public.consent_records FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid())
    OR (candidate_profile_id IS NOT NULL AND public.is_owning_candidate(auth.uid(), candidate_profile_id)));
CREATE POLICY "consent_own_insert" ON public.consent_records FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_staff(auth.uid())
    OR (candidate_profile_id IS NOT NULL AND public.is_owning_candidate(auth.uid(), candidate_profile_id)));
CREATE POLICY "consent_own_update" ON public.consent_records FOR UPDATE TO authenticated
  USING (public.is_platform_staff(auth.uid())
    OR (candidate_profile_id IS NOT NULL AND public.is_owning_candidate(auth.uid(), candidate_profile_id)));

CREATE TABLE public.data_subject_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code text NOT NULL UNIQUE,
  candidate_profile_id uuid REFERENCES public.candidate_profiles(id) ON DELETE SET NULL,
  subject_email citext NOT NULL,
  request_type text NOT NULL CHECK (request_type IN (
    'access','correction','export','deletion','consent_withdrawal','network_removal','notification_preferences'
  )),
  status text NOT NULL DEFAULT 'received' CHECK (status IN (
    'received','verifying','in_progress','completed','rejected','cancelled'
  )),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_note text,
  received_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  completed_at timestamptz,
  export_file_id uuid REFERENCES public.files(id) ON DELETE SET NULL,
  trace_id text
);
CREATE INDEX dsr_status_idx ON public.data_subject_requests(status, due_at);
CREATE INDEX dsr_email_idx ON public.data_subject_requests(subject_email);
GRANT SELECT, INSERT, UPDATE ON public.data_subject_requests TO authenticated;
GRANT ALL ON public.data_subject_requests TO service_role;
ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dsr_own_read" ON public.data_subject_requests FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid())
    OR (candidate_profile_id IS NOT NULL AND public.is_owning_candidate(auth.uid(), candidate_profile_id)));
CREATE POLICY "dsr_own_insert" ON public.data_subject_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_staff(auth.uid())
    OR (candidate_profile_id IS NOT NULL AND public.is_owning_candidate(auth.uid(), candidate_profile_id)));
CREATE POLICY "dsr_staff_update" ON public.data_subject_requests FOR UPDATE TO authenticated
  USING (public.is_platform_staff(auth.uid()));

CREATE TABLE public.retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_class text NOT NULL UNIQUE,
  entity text NOT NULL,
  retention_days integer,
  action text NOT NULL CHECK (action IN ('delete','anonymize','archive','retain_forever')),
  legal_basis text NOT NULL,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.retention_policies TO authenticated;
GRANT ALL ON public.retention_policies TO service_role;
ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "retention_read_all" ON public.retention_policies FOR SELECT TO authenticated USING (true);
CREATE POLICY "retention_staff_write" ON public.retention_policies FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));

INSERT INTO public.retention_policies (data_class, entity, retention_days, action, legal_basis, notes) VALUES
  ('unsuccessful_application','applications',180,'anonymize','legitimate_interest','Aggregated funnel metrics retained; PII stripped after 180 days.'),
  ('active_candidate_profile','candidate_profiles',NULL,'retain_forever','consent','Retained while candidate consent remains active.'),
  ('network_profile','candidate_profiles',730,'anonymize','consent','Talent Network consent renewed every 24 months; auto-anonymize on lapse.'),
  ('cv_versions','files',365,'delete','consent','Keep latest CV + one prior; older versions purged after 365 days.'),
  ('messages','messages',730,'delete','legitimate_interest','Conversations retained 24 months after last activity.'),
  ('processing_jobs','processing_jobs',90,'delete','legitimate_interest','Operational logs; 90 days for incident investigation.'),
  ('audit_events','audit_events',2555,'retain_forever','legal_obligation','7-year audit retention; never silently deleted.'),
  ('notification_deliveries','notification_deliveries',180,'delete','legitimate_interest','Delivery diagnostics; 180 days.'),
  ('score_runs','score_runs',NULL,'retain_forever','legitimate_interest','Immutable; tied to hiring decision evidence trail.'),
  ('deleted_accounts','profiles',30,'delete','legal_obligation','30-day grace after deletion request, then hard delete.');

CREATE TABLE public.retention_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.retention_policies(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  rows_affected integer,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed')),
  error text,
  trace_id text
);
GRANT SELECT ON public.retention_runs TO authenticated;
GRANT ALL ON public.retention_runs TO service_role;
ALTER TABLE public.retention_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "retention_runs_staff_read" ON public.retention_runs FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));

CREATE TRIGGER retention_policies_touch BEFORE UPDATE ON public.retention_policies
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

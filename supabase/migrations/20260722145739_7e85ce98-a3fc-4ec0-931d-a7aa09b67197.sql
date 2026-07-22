
CREATE TABLE public.support_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('platform_admin','operations')),
  target_user_id uuid NOT NULL,
  target_role_snapshot text,
  reason text NOT NULL CHECK (length(reason) >= 10),
  ticket_ref text,
  scope text NOT NULL DEFAULT 'read_only' CHECK (scope IN ('read_only','elevated')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ended_at timestamptz,
  end_reason text CHECK (end_reason IN ('user_exit','expired','revoked','system')),
  trace_id text NOT NULL,
  CHECK (expires_at > started_at AND expires_at <= started_at + interval '30 minutes'),
  CHECK (actor_user_id <> target_user_id)
);
CREATE INDEX support_sessions_active_idx
  ON public.support_sessions(actor_user_id, expires_at) WHERE ended_at IS NULL;
CREATE INDEX support_sessions_target_idx ON public.support_sessions(target_user_id, started_at DESC);
CREATE INDEX support_sessions_trace_idx ON public.support_sessions(trace_id);

GRANT SELECT ON public.support_sessions TO authenticated;
GRANT ALL ON public.support_sessions TO service_role;
ALTER TABLE public.support_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_sessions_read_staff" ON public.support_sessions
  FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));

-- Trigger: forbid operations from targeting platform_admin
CREATE OR REPLACE FUNCTION public.tg_support_session_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_is_platform_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = NEW.target_user_id AND status = 'active' AND role = 'platform_admin'
  ) INTO target_is_platform_admin;

  IF target_is_platform_admin AND NEW.actor_role = 'operations' THEN
    RAISE EXCEPTION 'operations role cannot start a support session on a platform_admin'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER support_session_guard_biu
  BEFORE INSERT OR UPDATE ON public.support_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_support_session_guard();

REVOKE EXECUTE ON FUNCTION public.tg_support_session_guard() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.support_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.support_sessions(id) ON DELETE SET NULL,
  actor_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN (
    'view_as_start','view_as_end',
    'resend_invitation','unlock_account','invalidate_sessions',
    'correct_membership','restore_member','deactivate_user',
    'repair_org_membership','elevate_scope','other'
  )),
  target_type text NOT NULL,
  target_id uuid,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  reason text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  trace_id text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_actions_time_idx ON public.support_actions(occurred_at DESC);
CREATE INDEX support_actions_target_idx ON public.support_actions(target_type, target_id);
CREATE INDEX support_actions_trace_idx ON public.support_actions(trace_id);

GRANT SELECT ON public.support_actions TO authenticated;
GRANT ALL ON public.support_actions TO service_role;
ALTER TABLE public.support_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "support_actions_read_staff" ON public.support_actions
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));

CREATE TABLE public.trace_index (
  reference_id text PRIMARY KEY,
  trace_id text NOT NULL,
  actor_user_id uuid,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  action text NOT NULL,
  request_summary jsonb,
  result text NOT NULL CHECK (result IN ('success','failure')),
  failure_reason text,
  http_status integer,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trace_index_trace_idx ON public.trace_index(trace_id);
CREATE INDEX trace_index_time_idx ON public.trace_index(occurred_at DESC);
CREATE INDEX trace_index_actor_idx ON public.trace_index(actor_user_id, occurred_at DESC);

GRANT SELECT ON public.trace_index TO authenticated;
GRANT ALL ON public.trace_index TO service_role;
ALTER TABLE public.trace_index ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trace_index_read_staff" ON public.trace_index
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));

INSERT INTO public.retention_policies (data_class, entity, retention_days, action, legal_basis, notes) VALUES
  ('support_session','support_sessions',   90, 'delete',   'legitimate_interest','Closed support sessions retained 90 days.'),
  ('support_action', 'support_actions',  2555, 'archive',  'legal_obligation',   '7 years for audit; append-only.'),
  ('trace_index',    'trace_index',       180, 'delete',   'legitimate_interest','User-facing error references retained 180 days.')
ON CONFLICT (data_class) DO NOTHING;

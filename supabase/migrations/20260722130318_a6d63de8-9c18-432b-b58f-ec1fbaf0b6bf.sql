
-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin','client','candidate');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- ORGS
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_normalized text NOT NULL,
  domain text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name_normalized, domain)
);
GRANT SELECT ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- MEMBERSHIPS
CREATE TABLE public.org_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);
GRANT SELECT ON public.org_memberships TO authenticated;
GRANT ALL ON public.org_memberships TO service_role;
ALTER TABLE public.org_memberships ENABLE ROW LEVEL SECURITY;

-- POSITIONS
CREATE TYPE public.position_status AS ENUM
  ('draft','submitted','needs_clarification','approved','active','paused','closed','archived');
CREATE TYPE public.work_model AS ENUM ('remote','hybrid','onsite');

CREATE TABLE public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  title text NOT NULL,
  work_model public.work_model NOT NULL,
  location text,
  employment_type text,
  seniority text,
  target_countries text[],
  compensation text,
  headcount int,
  hiring_urgency text,
  target_titles text[],
  work_authorization text,
  must_have_skills text[] NOT NULL DEFAULT '{}',
  preferred_requirements text,
  dealbreakers text,
  job_description text,
  status public.position_status NOT NULL DEFAULT 'submitted',
  visibility text NOT NULL DEFAULT 'private',
  intake_id uuid,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT positions_min_requirements CHECK (
    array_length(must_have_skills,1) >= 3
    OR (job_description IS NOT NULL AND char_length(job_description) >= 40)
  )
);
GRANT SELECT, INSERT, UPDATE ON public.positions TO authenticated;
GRANT ALL ON public.positions TO service_role;
GRANT SELECT ON public.positions TO anon;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.position_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id),
  snapshot jsonb NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.position_revisions TO authenticated;
GRANT ALL ON public.position_revisions TO service_role;
ALTER TABLE public.position_revisions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.screening_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  kind text NOT NULL DEFAULT 'short_text',
  required boolean NOT NULL DEFAULT false,
  ordering int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.screening_questions TO authenticated;
GRANT ALL ON public.screening_questions TO service_role;
GRANT SELECT ON public.screening_questions TO anon;
ALTER TABLE public.screening_questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.client_intakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text UNIQUE NOT NULL,
  submitter_email text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'received',
  trace_id text NOT NULL,
  org_id uuid REFERENCES public.organizations(id),
  position_id uuid REFERENCES public.positions(id),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT ON public.client_intakes TO authenticated;
GRANT ALL ON public.client_intakes TO service_role;
ALTER TABLE public.client_intakes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  diff jsonb,
  trace_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- POLICIES (all after tables exist)
CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_roles_admin_read" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "org_admin_all" ON public.organizations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "org_member_read" ON public.organizations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_memberships m WHERE m.org_id = organizations.id AND m.user_id = auth.uid()));

CREATE POLICY "memb_self_read" ON public.org_memberships FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "memb_admin_all" ON public.org_memberships FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "positions_admin_all" ON public.positions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "positions_member_read" ON public.positions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_memberships m WHERE m.org_id = positions.org_id AND m.user_id = auth.uid()));
CREATE POLICY "positions_public_active" ON public.positions FOR SELECT TO anon
  USING (status = 'active' AND visibility = 'public');

CREATE POLICY "revs_admin_all" ON public.position_revisions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "revs_member_read" ON public.position_revisions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.positions p JOIN public.org_memberships m
                 ON m.org_id = p.org_id WHERE p.id = position_revisions.position_id AND m.user_id = auth.uid()));

CREATE POLICY "sq_admin_all" ON public.screening_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "sq_member_read" ON public.screening_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.positions p JOIN public.org_memberships m
                 ON m.org_id = p.org_id WHERE p.id = screening_questions.position_id AND m.user_id = auth.uid()));
CREATE POLICY "sq_public_active" ON public.screening_questions FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.positions p WHERE p.id = screening_questions.position_id
                 AND p.status = 'active' AND p.visibility = 'public'));

CREATE POLICY "intake_admin_all" ON public.client_intakes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "audit_admin_read" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER positions_touch BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE INDEX positions_status_idx ON public.positions(status);
CREATE INDEX positions_org_idx ON public.positions(org_id);
CREATE INDEX screening_pos_idx ON public.screening_questions(position_id);

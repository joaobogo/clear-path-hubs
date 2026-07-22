
-- =========================================================================
-- Phase 2 canonical rebuild
-- =========================================================================

-- Drop legacy tables (keep user_roles, app_role, has_role)
DROP TABLE IF EXISTS public.client_intakes CASCADE;
DROP TABLE IF EXISTS public.position_revisions CASCADE;
DROP TABLE IF EXISTS public.screening_questions CASCADE;
DROP TABLE IF EXISTS public.positions CASCADE;
DROP TABLE IF EXISTS public.org_memberships CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;
DROP TABLE IF EXISTS public.audit_log CASCADE;

-- Drop obsolete enums we will recreate with the canonical shape
DROP TYPE IF EXISTS public.position_status CASCADE;
DROP TYPE IF EXISTS public.work_model CASCADE;

-- =========================================================================
-- Enums
-- =========================================================================
CREATE TYPE public.membership_role AS ENUM (
  'platform_admin','operations','client_admin','client_editor','client_viewer','candidate'
);
CREATE TYPE public.membership_status AS ENUM ('active','invited','suspended','removed');
CREATE TYPE public.org_status AS ENUM ('prospect','active','paused','archived');
CREATE TYPE public.profile_status AS ENUM ('active','suspended','deleted');
CREATE TYPE public.position_status AS ENUM (
  'draft','submitted','needs_clarification','approved','active','paused','closed','archived'
);
CREATE TYPE public.position_visibility AS ENUM ('public','private','internal');
CREATE TYPE public.work_model AS ENUM ('remote','hybrid','onsite');
CREATE TYPE public.employment_type AS ENUM ('full_time','part_time','contract','temporary','internship');
CREATE TYPE public.answer_type AS ENUM ('text','long_text','single_choice','multi_choice','boolean','number','date');
CREATE TYPE public.application_status AS ENUM (
  'submitted','processing','ready_for_review','withdrawn','rejected','archived'
);
CREATE TYPE public.match_stage AS ENUM (
  'new','reviewing','delivered','shortlisted','interview_process','offer','hired','not_moving_forward','archived'
);
CREATE TYPE public.admin_review_status AS ENUM ('pending','approved','rejected','on_hold');
CREATE TYPE public.client_visibility AS ENUM ('hidden','visible','archived');
CREATE TYPE public.score_status AS ENUM ('queued','running','completed','failed','cancelled');
CREATE TYPE public.score_decision_type AS ENUM ('approve','override','reject','request_recompute');
CREATE TYPE public.client_decision_type AS ENUM (
  'shortlist','request_interview','request_information','not_moving_forward','hire'
);
CREATE TYPE public.interview_status AS ENUM ('requested','scheduling','scheduled','completed','cancelled');
CREATE TYPE public.file_status AS ENUM ('uploading','ready','failed','deleted');
CREATE TYPE public.job_status AS ENUM ('queued','running','completed','failed','cancelled');

-- =========================================================================
-- Shared trigger fn (already exists as tg_touch_updated_at, reuse)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- =========================================================================
-- 1. organizations
-- =========================================================================
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_normalized text GENERATED ALWAYS AS (lower(btrim(name))) STORED,
  website text,
  domain text,
  industry text,
  headquarters text,
  status public.org_status NOT NULL DEFAULT 'prospect',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX organizations_name_norm_uniq ON public.organizations(name_normalized);
CREATE INDEX organizations_status_idx ON public.organizations(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER organizations_touch BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =========================================================================
-- 2. profiles (application profile per auth user)
-- =========================================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text NOT NULL,
  phone text,
  locale text,
  timezone text,
  status public.profile_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profiles_email_idx ON public.profiles(lower(email));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =========================================================================
-- 3. memberships
-- =========================================================================
CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.membership_role NOT NULL,
  status public.membership_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id, role)
);
CREATE INDEX memberships_user_idx ON public.memberships(user_id) WHERE status = 'active';
CREATE INDEX memberships_org_idx  ON public.memberships(organization_id) WHERE status = 'active';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- Helper: is user a member of org (SECURITY DEFINER, avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_org_member(_user uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user AND organization_id = _org AND status = 'active'
  )
$$;
REVOKE ALL ON FUNCTION public.is_org_member(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.is_platform_staff(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user AND status = 'active'
      AND role IN ('platform_admin','operations')
  )
$$;
REVOKE ALL ON FUNCTION public.is_platform_staff(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_staff(uuid) TO service_role;

-- =========================================================================
-- 4. positions (canonical role record)
-- =========================================================================
CREATE TABLE public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  title text NOT NULL,
  department text,
  location text,
  work_model public.work_model,
  employment_type public.employment_type,
  seniority text,
  description text,
  requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferred_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  dealbreakers jsonb NOT NULL DEFAULT '[]'::jsonb,
  compensation jsonb NOT NULL DEFAULT '{}'::jsonb,
  work_authorization jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.position_status NOT NULL DEFAULT 'draft',
  visibility public.position_visibility NOT NULL DEFAULT 'private',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX positions_org_idx    ON public.positions(organization_id);
CREATE INDEX positions_status_idx ON public.positions(status);
CREATE INDEX positions_public_idx ON public.positions(visibility, status)
  WHERE visibility = 'public' AND status = 'active';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positions TO authenticated;
GRANT SELECT ON public.positions TO anon;
GRANT ALL ON public.positions TO service_role;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER positions_touch BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =========================================================================
-- 5. screening_questions
-- =========================================================================
CREATE TABLE public.screening_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer_type public.answer_type NOT NULL DEFAULT 'text',
  required boolean NOT NULL DEFAULT false,
  options jsonb,
  preferred_answer jsonb,
  dealbreaker boolean NOT NULL DEFAULT false,
  scoring_weight numeric(5,2) NOT NULL DEFAULT 1.0,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX screening_questions_position_idx ON public.screening_questions(position_id, display_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.screening_questions TO authenticated;
GRANT SELECT ON public.screening_questions TO anon;
GRANT ALL ON public.screening_questions TO service_role;
ALTER TABLE public.screening_questions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER screening_questions_touch BEFORE UPDATE ON public.screening_questions
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =========================================================================
-- 6. candidate_profiles
-- =========================================================================
CREATE TABLE public.candidate_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  location text,
  headline text,
  experience jsonb NOT NULL DEFAULT '[]'::jsonb,
  skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  languages jsonb NOT NULL DEFAULT '[]'::jsonb,
  education jsonb NOT NULL DEFAULT '[]'::jsonb,
  work_authorization jsonb NOT NULL DEFAULT '{}'::jsonb,
  availability jsonb NOT NULL DEFAULT '{}'::jsonb,
  compensation_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_cv_file_id uuid,
  consent jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX candidate_profiles_email_uniq ON public.candidate_profiles(lower(email));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_profiles TO authenticated;
GRANT ALL ON public.candidate_profiles TO service_role;
ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER candidate_profiles_touch BEFORE UPDATE ON public.candidate_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =========================================================================
-- 7. files
-- =========================================================================
CREATE TABLE public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  candidate_profile_id uuid REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  filename text NOT NULL,
  mime_type text,
  size bigint,
  checksum text,
  file_status public.file_status NOT NULL DEFAULT 'uploading',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storage_bucket, storage_path)
);
CREATE INDEX files_candidate_idx ON public.files(candidate_profile_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.files TO authenticated;
GRANT ALL ON public.files TO service_role;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.candidate_profiles
  ADD CONSTRAINT candidate_profiles_cv_fk
  FOREIGN KEY (current_cv_file_id) REFERENCES public.files(id) ON DELETE SET NULL;

-- =========================================================================
-- 8. applications
-- =========================================================================
CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id uuid NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE RESTRICT,
  source text,
  status public.application_status NOT NULL DEFAULT 'submitted',
  applied_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Unique active application per candidate + position
CREATE UNIQUE INDEX applications_active_uniq
  ON public.applications(candidate_profile_id, position_id)
  WHERE status NOT IN ('withdrawn','rejected','archived');
CREATE INDEX applications_position_idx ON public.applications(position_id, status);
CREATE INDEX applications_candidate_idx ON public.applications(candidate_profile_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER applications_touch BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =========================================================================
-- 9. application_answers
-- =========================================================================
CREATE TABLE public.application_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.screening_questions(id) ON DELETE CASCADE,
  answer jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, question_id)
);
CREATE INDEX application_answers_app_idx ON public.application_answers(application_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_answers TO authenticated;
GRANT ALL ON public.application_answers TO service_role;
ALTER TABLE public.application_answers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER application_answers_touch BEFORE UPDATE ON public.application_answers
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =========================================================================
-- 10. candidate_matches
-- =========================================================================
CREATE TABLE public.candidate_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL UNIQUE REFERENCES public.applications(id) ON DELETE CASCADE,
  candidate_profile_id uuid NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  stage public.match_stage NOT NULL DEFAULT 'new',
  admin_status public.admin_review_status NOT NULL DEFAULT 'pending',
  client_visibility public.client_visibility NOT NULL DEFAULT 'hidden',
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX candidate_matches_org_stage_idx ON public.candidate_matches(organization_id, stage);
CREATE INDEX candidate_matches_position_idx  ON public.candidate_matches(position_id, stage);
CREATE INDEX candidate_matches_admin_idx     ON public.candidate_matches(admin_status);
CREATE INDEX candidate_matches_client_visible_idx
  ON public.candidate_matches(organization_id, position_id)
  WHERE client_visibility = 'visible';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_matches TO authenticated;
GRANT ALL ON public.candidate_matches TO service_role;
ALTER TABLE public.candidate_matches ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER candidate_matches_touch BEFORE UPDATE ON public.candidate_matches
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =========================================================================
-- 11. score_runs (immutable when completed)
-- =========================================================================
CREATE TABLE public.score_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_match_id uuid NOT NULL REFERENCES public.candidate_matches(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE RESTRICT,
  engine_version text NOT NULL,
  score numeric(6,2),
  confidence numeric(5,4),
  status public.score_status NOT NULL DEFAULT 'queued',
  explanation text,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  requirement_coverage jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  trace_id text
);
CREATE INDEX score_runs_match_idx ON public.score_runs(candidate_match_id, completed_at DESC);
CREATE INDEX score_runs_position_idx ON public.score_runs(position_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.score_runs TO authenticated;
GRANT ALL ON public.score_runs TO service_role;
ALTER TABLE public.score_runs ENABLE ROW LEVEL SECURITY;

-- Immutability: once completed/failed/cancelled, no updates
CREATE OR REPLACE FUNCTION public.tg_score_runs_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status IN ('completed','failed','cancelled') THEN
    RAISE EXCEPTION 'score_runs row % is immutable (status=%)', OLD.id, OLD.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER score_runs_immutable
  BEFORE UPDATE OR DELETE ON public.score_runs
  FOR EACH ROW EXECUTE FUNCTION public.tg_score_runs_immutable();

-- =========================================================================
-- 12. score_decisions
-- =========================================================================
CREATE TABLE public.score_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_match_id uuid NOT NULL REFERENCES public.candidate_matches(id) ON DELETE CASCADE,
  score_run_id uuid NOT NULL REFERENCES public.score_runs(id) ON DELETE RESTRICT,
  decision_type public.score_decision_type NOT NULL,
  approved_score numeric(6,2),
  reason text,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX score_decisions_match_idx ON public.score_decisions(candidate_match_id, created_at DESC);
GRANT SELECT, INSERT ON public.score_decisions TO authenticated;
GRANT ALL ON public.score_decisions TO service_role;
ALTER TABLE public.score_decisions ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- 13. client_decisions
-- =========================================================================
CREATE TABLE public.client_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_match_id uuid NOT NULL REFERENCES public.candidate_matches(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  decision public.client_decision_type NOT NULL,
  feedback text,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX client_decisions_match_idx ON public.client_decisions(candidate_match_id, created_at DESC);
CREATE INDEX client_decisions_org_idx   ON public.client_decisions(organization_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.client_decisions TO authenticated;
GRANT ALL ON public.client_decisions TO service_role;
ALTER TABLE public.client_decisions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER client_decisions_touch BEFORE UPDATE ON public.client_decisions
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =========================================================================
-- 14. interviews
-- =========================================================================
CREATE TABLE public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_match_id uuid NOT NULL REFERENCES public.candidate_matches(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status public.interview_status NOT NULL DEFAULT 'requested',
  requested_at timestamptz NOT NULL DEFAULT now(),
  scheduled_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX interviews_match_idx ON public.interviews(candidate_match_id);
CREATE INDEX interviews_org_status_idx ON public.interviews(organization_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interviews TO authenticated;
GRANT ALL ON public.interviews TO service_role;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER interviews_touch BEFORE UPDATE ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =========================================================================
-- 15. messages
-- =========================================================================
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX messages_thread_idx ON public.messages(thread_id, created_at);
CREATE INDEX messages_sender_idx ON public.messages(sender_user_id);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- 16. audit_events
-- =========================================================================
CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  trace_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_entity_idx ON public.audit_events(entity_type, entity_id, created_at DESC);
CREATE INDEX audit_events_org_idx ON public.audit_events(organization_id, created_at DESC);
CREATE INDEX audit_events_trace_idx ON public.audit_events(trace_id);
GRANT SELECT, INSERT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- 17. processing_jobs
-- =========================================================================
CREATE TABLE public.processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  job_type text NOT NULL,
  status public.job_status NOT NULL DEFAULT 'queued',
  attempts int NOT NULL DEFAULT 0,
  error_code text,
  error_message text,
  trace_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);
CREATE INDEX processing_jobs_status_idx ON public.processing_jobs(status, created_at);
CREATE INDEX processing_jobs_entity_idx ON public.processing_jobs(entity_type, entity_id);
GRANT SELECT ON public.processing_jobs TO authenticated;
GRANT ALL ON public.processing_jobs TO service_role;
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- RLS Policies
-- =========================================================================

-- organizations: members read own, platform staff read all
CREATE POLICY organizations_member_read ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), id) OR public.is_platform_staff(auth.uid()));
CREATE POLICY organizations_staff_write ON public.organizations FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));

-- profiles: user manages own; staff read all
CREATE POLICY profiles_self ON public.profiles FOR ALL TO authenticated
  USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY profiles_staff_read ON public.profiles FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));

-- memberships: user reads own; staff manage
CREATE POLICY memberships_self_read ON public.memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_staff(auth.uid()));
CREATE POLICY memberships_staff_write ON public.memberships FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));

-- positions: public rows visible to anon; org members + staff full read; staff write
CREATE POLICY positions_public_read ON public.positions FOR SELECT TO anon
  USING (visibility = 'public' AND status = 'active');
CREATE POLICY positions_authenticated_read ON public.positions FOR SELECT TO authenticated
  USING (
    (visibility = 'public' AND status = 'active')
    OR public.is_org_member(auth.uid(), organization_id)
    OR public.is_platform_staff(auth.uid())
  );
CREATE POLICY positions_staff_write ON public.positions FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));

-- screening_questions: follow position visibility
CREATE POLICY sq_public_read ON public.screening_questions FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.positions p WHERE p.id = position_id
                 AND p.visibility = 'public' AND p.status = 'active'));
CREATE POLICY sq_auth_read ON public.screening_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.positions p WHERE p.id = position_id
                 AND ((p.visibility='public' AND p.status='active')
                      OR public.is_org_member(auth.uid(), p.organization_id)
                      OR public.is_platform_staff(auth.uid()))));
CREATE POLICY sq_staff_write ON public.screening_questions FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));

-- candidate_profiles: owner + staff
CREATE POLICY cp_self ON public.candidate_profiles FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY cp_staff_read ON public.candidate_profiles FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));

-- files: owner + staff
CREATE POLICY files_self ON public.files FOR ALL TO authenticated
  USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY files_staff_read ON public.files FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));

-- applications: candidate reads own; staff read all
CREATE POLICY applications_candidate_read ON public.applications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.candidate_profiles cp
                 WHERE cp.id = candidate_profile_id AND cp.user_id = auth.uid())
         OR public.is_platform_staff(auth.uid()));
CREATE POLICY applications_candidate_insert ON public.applications FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.candidate_profiles cp
                      WHERE cp.id = candidate_profile_id AND cp.user_id = auth.uid()));
CREATE POLICY applications_staff_write ON public.applications FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));

-- application_answers: mirror application
CREATE POLICY aa_read ON public.application_answers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.applications a
                 JOIN public.candidate_profiles cp ON cp.id = a.candidate_profile_id
                 WHERE a.id = application_id
                   AND (cp.user_id = auth.uid() OR public.is_platform_staff(auth.uid()))));
CREATE POLICY aa_staff_write ON public.application_answers FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));

-- candidate_matches: staff full; org members see visible; candidate sees own
CREATE POLICY cm_staff ON public.candidate_matches FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));
CREATE POLICY cm_client_read ON public.candidate_matches FOR SELECT TO authenticated
  USING (client_visibility = 'visible' AND public.is_org_member(auth.uid(), organization_id));
CREATE POLICY cm_candidate_read ON public.candidate_matches FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.candidate_profiles cp
                 WHERE cp.id = candidate_profile_id AND cp.user_id = auth.uid()));

-- score_runs: staff only, plus org members read completed for visible matches
CREATE POLICY sr_staff ON public.score_runs FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));
CREATE POLICY sr_client_read ON public.score_runs FOR SELECT TO authenticated
  USING (status = 'completed' AND EXISTS (
    SELECT 1 FROM public.candidate_matches m
    WHERE m.id = candidate_match_id AND m.client_visibility = 'visible'
      AND public.is_org_member(auth.uid(), m.organization_id)
  ));

-- score_decisions: staff only
CREATE POLICY sd_staff ON public.score_decisions FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));

-- client_decisions: org members + staff
CREATE POLICY cd_org ON public.client_decisions FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

-- interviews: org members + staff
CREATE POLICY iv_org ON public.interviews FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

-- messages: sender + staff (thread-based reads gated by app)
CREATE POLICY messages_sender ON public.messages FOR SELECT TO authenticated
  USING (sender_user_id = auth.uid() OR public.is_platform_staff(auth.uid()));
CREATE POLICY messages_insert ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_user_id = auth.uid());

-- audit_events: staff only
CREATE POLICY ae_staff ON public.audit_events FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));

-- processing_jobs: staff only
CREATE POLICY pj_staff ON public.processing_jobs FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));

-- =========================================================================
-- Domain views
-- =========================================================================

-- Candidate
CREATE OR REPLACE VIEW public.candidate_my_applications
WITH (security_invoker = true) AS
SELECT a.id AS application_id, a.status, a.applied_at, a.withdrawn_at,
       p.id AS position_id, p.title, p.location, p.work_model, p.employment_type,
       o.id AS organization_id, o.name AS organization_name,
       m.stage, m.client_visibility
FROM public.applications a
JOIN public.candidate_profiles cp ON cp.id = a.candidate_profile_id
JOIN public.positions p ON p.id = a.position_id
JOIN public.organizations o ON o.id = p.organization_id
LEFT JOIN public.candidate_matches m ON m.application_id = a.id
WHERE cp.user_id = auth.uid();

CREATE OR REPLACE VIEW public.candidate_profile_view
WITH (security_invoker = true) AS
SELECT cp.* FROM public.candidate_profiles cp WHERE cp.user_id = auth.uid();

CREATE OR REPLACE VIEW public.candidate_messages_view
WITH (security_invoker = true) AS
SELECT m.* FROM public.messages m WHERE m.sender_user_id = auth.uid();

-- Client
CREATE OR REPLACE VIEW public.client_positions_view
WITH (security_invoker = true) AS
SELECT p.*, o.name AS organization_name,
       (SELECT count(*) FROM public.candidate_matches cm
         WHERE cm.position_id = p.id AND cm.client_visibility='visible') AS visible_matches
FROM public.positions p
JOIN public.organizations o ON o.id = p.organization_id;

CREATE OR REPLACE VIEW public.client_candidate_matches_view
WITH (security_invoker = true) AS
SELECT m.id, m.position_id, m.organization_id, m.stage, m.delivered_at,
       p.title AS position_title,
       cp.full_name, cp.headline, cp.location,
       (SELECT sr.score FROM public.score_runs sr
          WHERE sr.candidate_match_id = m.id AND sr.status='completed'
          ORDER BY sr.completed_at DESC LIMIT 1) AS latest_score
FROM public.candidate_matches m
JOIN public.candidate_profiles cp ON cp.id = m.candidate_profile_id
JOIN public.positions p ON p.id = m.position_id
WHERE m.client_visibility = 'visible';

CREATE OR REPLACE VIEW public.client_dashboard_kpis
WITH (security_invoker = true) AS
SELECT m.organization_id,
       count(*) FILTER (WHERE m.client_visibility='visible') AS visible_matches,
       count(*) FILTER (WHERE m.stage='shortlisted') AS shortlisted,
       count(*) FILTER (WHERE m.stage='interview_process') AS in_interview,
       count(*) FILTER (WHERE m.stage='offer') AS offers,
       count(*) FILTER (WHERE m.stage='hired') AS hires
FROM public.candidate_matches m
GROUP BY m.organization_id;

CREATE OR REPLACE VIEW public.client_kanban_view
WITH (security_invoker = true) AS
SELECT m.id, m.position_id, m.organization_id, m.stage,
       cp.full_name, cp.headline
FROM public.candidate_matches m
JOIN public.candidate_profiles cp ON cp.id = m.candidate_profile_id
WHERE m.client_visibility = 'visible';

CREATE OR REPLACE VIEW public.client_messages_view
WITH (security_invoker = true) AS
SELECT m.* FROM public.messages m
WHERE (m.recipient_context->>'organization_id')::uuid IN (
  SELECT organization_id FROM public.memberships
  WHERE user_id = auth.uid() AND status='active'
);

-- Admin
CREATE OR REPLACE VIEW public.admin_work_inbox
WITH (security_invoker = true) AS
SELECT m.id, m.application_id, m.position_id, m.organization_id,
       m.admin_status, m.stage, m.created_at,
       cp.full_name, p.title AS position_title, o.name AS organization_name
FROM public.candidate_matches m
JOIN public.candidate_profiles cp ON cp.id = m.candidate_profile_id
JOIN public.positions p ON p.id = m.position_id
JOIN public.organizations o ON o.id = m.organization_id
WHERE m.admin_status IN ('pending','on_hold');

CREATE OR REPLACE VIEW public.admin_clients_view
WITH (security_invoker = true) AS
SELECT o.*,
       (SELECT count(*) FROM public.positions p WHERE p.organization_id=o.id) AS total_positions,
       (SELECT count(*) FROM public.positions p
         WHERE p.organization_id=o.id AND p.status='active') AS active_positions
FROM public.organizations o;

CREATE OR REPLACE VIEW public.admin_positions_view
WITH (security_invoker = true) AS
SELECT p.*, o.name AS organization_name,
       (SELECT count(*) FROM public.applications a WHERE a.position_id=p.id) AS total_applications,
       (SELECT count(*) FROM public.candidate_matches m
         WHERE m.position_id=p.id AND m.admin_status='pending') AS pending_reviews
FROM public.positions p
JOIN public.organizations o ON o.id = p.organization_id;

CREATE OR REPLACE VIEW public.admin_candidate_matches_view
WITH (security_invoker = true) AS
SELECT m.*, cp.full_name, cp.email, p.title AS position_title, o.name AS organization_name,
       (SELECT sr.score FROM public.score_runs sr
          WHERE sr.candidate_match_id=m.id AND sr.status='completed'
          ORDER BY sr.completed_at DESC LIMIT 1) AS latest_score
FROM public.candidate_matches m
JOIN public.candidate_profiles cp ON cp.id = m.candidate_profile_id
JOIN public.positions p ON p.id = m.position_id
JOIN public.organizations o ON o.id = m.organization_id;

CREATE OR REPLACE VIEW public.admin_pipeline_health
WITH (security_invoker = true) AS
SELECT p.id AS position_id, p.title, o.name AS organization_name,
       count(m.*) AS total_matches,
       count(*) FILTER (WHERE m.admin_status='pending') AS pending,
       count(*) FILTER (WHERE m.stage='delivered') AS delivered,
       count(*) FILTER (WHERE m.stage='shortlisted') AS shortlisted,
       count(*) FILTER (WHERE m.stage='hired') AS hired
FROM public.positions p
JOIN public.organizations o ON o.id = p.organization_id
LEFT JOIN public.candidate_matches m ON m.position_id = p.id
GROUP BY p.id, p.title, o.name;

GRANT SELECT ON
  public.candidate_my_applications,
  public.candidate_profile_view,
  public.candidate_messages_view,
  public.client_positions_view,
  public.client_candidate_matches_view,
  public.client_dashboard_kpis,
  public.client_kanban_view,
  public.client_messages_view,
  public.admin_work_inbox,
  public.admin_clients_view,
  public.admin_positions_view,
  public.admin_candidate_matches_view,
  public.admin_pipeline_health
TO authenticated;

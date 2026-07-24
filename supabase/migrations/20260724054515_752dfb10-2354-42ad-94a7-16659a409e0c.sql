
-- =====================================================================
-- 1) CANDIDATE STAGE HISTORY (immutable, attributable)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.candidate_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_match_id uuid NOT NULL REFERENCES public.candidate_matches(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  candidate_profile_id uuid NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid,
  actor_role text,
  trace_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.candidate_stage_history TO authenticated;
GRANT ALL ON public.candidate_stage_history TO service_role;

ALTER TABLE public.candidate_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read stage history"
  ON public.candidate_stage_history FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), organization_id)
    OR public.is_platform_staff(auth.uid())
  );

CREATE POLICY "org editors write stage history"
  ON public.candidate_stage_history FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_editor(auth.uid(), organization_id)
    OR public.is_platform_staff(auth.uid())
  );

-- Append-only: forbid update / delete (except service_role which bypasses RLS)
CREATE OR REPLACE FUNCTION public.tg_stage_history_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  RAISE EXCEPTION 'candidate_stage_history is append-only'
    USING ERRCODE = 'insufficient_privilege';
END $$;

DROP TRIGGER IF EXISTS trg_stage_history_no_update ON public.candidate_stage_history;
CREATE TRIGGER trg_stage_history_no_update
  BEFORE UPDATE OR DELETE ON public.candidate_stage_history
  FOR EACH ROW EXECUTE FUNCTION public.tg_stage_history_immutable();

CREATE INDEX IF NOT EXISTS idx_stage_history_match_created
  ON public.candidate_stage_history (candidate_match_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stage_history_org_created
  ON public.candidate_stage_history (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stage_history_position_created
  ON public.candidate_stage_history (position_id, created_at DESC);

-- Auto-log stage transitions on candidate_matches
CREATE OR REPLACE FUNCTION public.tg_candidate_matches_log_stage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.candidate_stage_history(
      candidate_match_id, organization_id, position_id, candidate_profile_id,
      from_stage, to_stage, reason, actor_user_id
    ) VALUES (
      NEW.id, NEW.organization_id, NEW.position_id, NEW.candidate_profile_id,
      NULL, NEW.stage::text, 'created', auth.uid()
    );
    RETURN NEW;
  END IF;

  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO public.candidate_stage_history(
      candidate_match_id, organization_id, position_id, candidate_profile_id,
      from_stage, to_stage, actor_user_id
    ) VALUES (
      NEW.id, NEW.organization_id, NEW.position_id, NEW.candidate_profile_id,
      OLD.stage::text, NEW.stage::text, auth.uid()
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_candidate_matches_log_stage ON public.candidate_matches;
CREATE TRIGGER trg_candidate_matches_log_stage
  AFTER INSERT OR UPDATE OF stage ON public.candidate_matches
  FOR EACH ROW EXECUTE FUNCTION public.tg_candidate_matches_log_stage();

-- Backfill "created" rows for existing matches that have no history yet
INSERT INTO public.candidate_stage_history(
  candidate_match_id, organization_id, position_id, candidate_profile_id,
  from_stage, to_stage, reason, created_at
)
SELECT m.id, m.organization_id, m.position_id, m.candidate_profile_id,
       NULL, m.stage::text, 'backfill', m.created_at
FROM public.candidate_matches m
WHERE NOT EXISTS (
  SELECT 1 FROM public.candidate_stage_history h WHERE h.candidate_match_id = m.id
);

-- =====================================================================
-- 2) POSITION VERSIONS (reproducible role snapshots)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.position_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  title text NOT NULL,
  description text,
  requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferred_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  dealbreakers jsonb NOT NULL DEFAULT '[]'::jsonb,
  compensation jsonb,
  intake_context jsonb,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (position_id, version_number)
);

GRANT SELECT, INSERT ON public.position_versions TO authenticated;
GRANT ALL ON public.position_versions TO service_role;

ALTER TABLE public.position_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read position versions"
  ON public.position_versions FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), organization_id)
    OR public.is_platform_staff(auth.uid())
  );

CREATE POLICY "org editors create position versions"
  ON public.position_versions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_editor(auth.uid(), organization_id)
    OR public.is_platform_staff(auth.uid())
  );

CREATE OR REPLACE FUNCTION public.tg_position_versions_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  RAISE EXCEPTION 'position_versions is append-only'
    USING ERRCODE = 'insufficient_privilege';
END $$;

DROP TRIGGER IF EXISTS trg_position_versions_no_update ON public.position_versions;
CREATE TRIGGER trg_position_versions_no_update
  BEFORE UPDATE OR DELETE ON public.position_versions
  FOR EACH ROW EXECUTE FUNCTION public.tg_position_versions_immutable();

CREATE INDEX IF NOT EXISTS idx_position_versions_position
  ON public.position_versions (position_id, version_number DESC);

-- =====================================================================
-- 3) TASKS (next actions across the workspace)
-- =====================================================================
DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('open','in_progress','done','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_priority AS ENUM ('low','normal','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  candidate_match_id uuid REFERENCES public.candidate_matches(id) ON DELETE CASCADE,
  candidate_profile_id uuid REFERENCES public.candidate_profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status public.task_status NOT NULL DEFAULT 'open',
  priority public.task_priority NOT NULL DEFAULT 'normal',
  due_at timestamptz,
  assignee_user_id uuid,
  created_by uuid,
  completed_by uuid,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND (
      public.is_org_member(auth.uid(), organization_id)
      OR public.is_platform_staff(auth.uid())
    )
  );

CREATE POLICY "org editors create tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_editor(auth.uid(), organization_id)
    OR public.is_platform_staff(auth.uid())
  );

CREATE POLICY "org editors update tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (
    public.is_org_editor(auth.uid(), organization_id)
    OR public.is_platform_staff(auth.uid())
  )
  WITH CHECK (
    public.is_org_editor(auth.uid(), organization_id)
    OR public.is_platform_staff(auth.uid())
  );

CREATE POLICY "org admins delete tasks"
  ON public.tasks FOR DELETE TO authenticated
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.is_platform_staff(auth.uid())
  );

DROP TRIGGER IF EXISTS trg_tasks_touch ON public.tasks;
CREATE TRIGGER trg_tasks_touch
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_tasks_org_status
  ON public.tasks (organization_id, status, due_at NULLS LAST)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assignee
  ON public.tasks (assignee_user_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_match
  ON public.tasks (candidate_match_id)
  WHERE deleted_at IS NULL;

-- =====================================================================
-- 4) HOT-PATH INDEXES for common dashboard filters
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_candidate_matches_org_stage_updated
  ON public.candidate_matches (organization_id, stage, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidate_matches_position_stage
  ON public.candidate_matches (position_id, stage);
CREATE INDEX IF NOT EXISTS idx_positions_org_status
  ON public.positions (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_position_created
  ON public.applications (position_id, created_at DESC);

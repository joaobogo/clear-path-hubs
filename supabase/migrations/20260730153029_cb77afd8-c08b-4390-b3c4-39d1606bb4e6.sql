
-- Sourcing operations: admin-managed record per position + richer campaign fields.

ALTER TABLE public.outreach_campaigns
  ADD COLUMN IF NOT EXISTS external_ref text,
  ADD COLUMN IF NOT EXISTS next_action text,
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_identified integer,
  ADD COLUMN IF NOT EXISTS manual_contacted integer,
  ADD COLUMN IF NOT EXISTS manual_engaged integer,
  ADD COLUMN IF NOT EXISTS manual_replied integer;

CREATE TABLE IF NOT EXISTS public.position_sourcing_plans (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null unique references public.positions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  strategy_status text not null default 'not_started',
  strategy_notes text,
  job_board_status text not null default 'not_started',
  sponsored_status text not null default 'not_started',
  owner_user_id uuid,
  next_action text,
  next_action_at timestamptz,
  exceptions text,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  CONSTRAINT position_sourcing_plans_strategy_status_chk
    CHECK (strategy_status IN ('not_started','analysing','ready','active','paused','complete')),
  CONSTRAINT position_sourcing_plans_job_board_status_chk
    CHECK (job_board_status IN ('not_started','preparing','distributed','paused','ended')),
  CONSTRAINT position_sourcing_plans_sponsored_status_chk
    CHECK (sponsored_status IN ('not_started','requested','running','paused','ended'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.position_sourcing_plans TO authenticated;
GRANT ALL ON public.position_sourcing_plans TO service_role;

ALTER TABLE public.position_sourcing_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS position_sourcing_plans_read ON public.position_sourcing_plans;
CREATE POLICY position_sourcing_plans_read ON public.position_sourcing_plans
  FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()) OR public.is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS position_sourcing_plans_write ON public.position_sourcing_plans;
CREATE POLICY position_sourcing_plans_write ON public.position_sourcing_plans
  FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_platform_staff(auth.uid()));

DROP TRIGGER IF EXISTS trg_position_sourcing_plans_touch ON public.position_sourcing_plans;
CREATE TRIGGER trg_position_sourcing_plans_touch
  BEFORE UPDATE ON public.position_sourcing_plans
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_position_sourcing_plans_org ON public.position_sourcing_plans(organization_id);

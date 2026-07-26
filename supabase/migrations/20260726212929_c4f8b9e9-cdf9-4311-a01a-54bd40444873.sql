-- Interview scheduling: canonical record extensions, status history, org scheduling settings,
-- and delivery retry bookkeeping.

-- 1. Interview record extensions ------------------------------------------------
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS scheduling_method text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS calendly_url text,
  ADD COLUMN IF NOT EXISTS availability_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS candidate_response text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS candidate_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS candidate_selected_time timestamptz,
  ADD COLUMN IF NOT EXISTS candidate_note text,
  ADD COLUMN IF NOT EXISTS reschedule_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS previous_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_coordination_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requested_by_user_id uuid;

DO $$ BEGIN
  ALTER TABLE public.interviews
    ADD CONSTRAINT interviews_scheduling_method_chk
    CHECK (scheduling_method IN ('manual','calendly'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.interviews
    ADD CONSTRAINT interviews_candidate_response_chk
    CHECK (candidate_response IN ('pending','accepted','declined','expired'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Canonical status history ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.interview_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  actor_user_id uuid,
  actor_role text,
  scheduled_at timestamptz,
  timezone text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_status_history_interview
  ON public.interview_status_history(interview_id, created_at DESC);

GRANT SELECT ON public.interview_status_history TO authenticated;
GRANT ALL ON public.interview_status_history TO service_role;
ALTER TABLE public.interview_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "history readable by org members" ON public.interview_status_history;
CREATE POLICY "history readable by org members"
  ON public.interview_status_history FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

DROP POLICY IF EXISTS "history readable by the candidate" ON public.interview_status_history;
CREATE POLICY "history readable by the candidate"
  ON public.interview_status_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.interviews i
    JOIN public.candidate_matches cm ON cm.id = i.candidate_match_id
    JOIN public.candidate_profiles cp ON cp.id = cm.candidate_profile_id
    WHERE i.id = interview_status_history.interview_id
      AND cp.user_id = auth.uid()
  ));

-- Trigger: every status change is recorded exactly once.
CREATE OR REPLACE FUNCTION public.tg_interviews_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.interview_status_history
      (interview_id, organization_id, from_status, to_status, actor_user_id, scheduled_at, timezone)
    VALUES (NEW.id, NEW.organization_id, NULL, NEW.status::text, NEW.created_by, NEW.scheduled_at, NEW.timezone);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    INSERT INTO public.interview_status_history
      (interview_id, organization_id, from_status, to_status, actor_user_id, scheduled_at, timezone, reason)
    VALUES (
      NEW.id, NEW.organization_id, OLD.status::text, NEW.status::text, NEW.updated_by,
      NEW.scheduled_at, NEW.timezone,
      CASE WHEN NEW.status::text = 'cancelled' THEN NEW.cancel_reason ELSE NULL END
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_interviews_status_history ON public.interviews;
CREATE TRIGGER trg_interviews_status_history
  AFTER INSERT OR UPDATE ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.tg_interviews_status_history();

-- 3. Organization scheduling settings -------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_scheduling_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  default_timezone text NOT NULL DEFAULT 'UTC',
  scheduling_method text NOT NULL DEFAULT 'manual',
  calendly_url text,
  availability_window_days integer NOT NULL DEFAULT 14,
  require_admin_coordination boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_scheduling_method_chk CHECK (scheduling_method IN ('manual','calendly'))
);

GRANT SELECT, INSERT, UPDATE ON public.org_scheduling_settings TO authenticated;
GRANT ALL ON public.org_scheduling_settings TO service_role;
ALTER TABLE public.org_scheduling_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scheduling settings readable by org members" ON public.org_scheduling_settings;
CREATE POLICY "scheduling settings readable by org members"
  ON public.org_scheduling_settings FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

DROP POLICY IF EXISTS "scheduling settings writable by org editors" ON public.org_scheduling_settings;
CREATE POLICY "scheduling settings writable by org editors"
  ON public.org_scheduling_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

DROP POLICY IF EXISTS "scheduling settings updatable by org editors" ON public.org_scheduling_settings;
CREATE POLICY "scheduling settings updatable by org editors"
  ON public.org_scheduling_settings FOR UPDATE TO authenticated
  USING (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

-- 4. Delivery retry bookkeeping --------------------------------------------------
ALTER TABLE public.notification_deliveries
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS recipient_address text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_deliveries_idem
  ON public.notification_deliveries(idempotency_key) WHERE idempotency_key IS NOT NULL;

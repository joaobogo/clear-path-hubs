
-- Hire status enum for the offer/hire lifecycle
CREATE TYPE public.hire_status AS ENUM (
  'offer_drafted',
  'offer_sent',
  'offer_accepted',
  'offer_declined',
  'hire_confirmed',
  'closed_lost'
);

-- Close reason enum, used when a role closes without a hire or an offer is declined
CREATE TYPE public.hire_close_reason AS ENUM (
  'candidate_declined',
  'counter_offer',
  'other_offer_accepted',
  'compensation_mismatch',
  'role_paused',
  'budget',
  'timing',
  'culture_fit',
  'background_check',
  'position_cancelled',
  'other'
);

-- One hire_record per candidate_match. Tracks the full offer -> hire lifecycle
-- with individual timestamps for each transition so we can compute time-to-hire
-- and owner accountability without inspecting the audit trail.
CREATE TABLE public.hire_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_match_id uuid NOT NULL UNIQUE
    REFERENCES public.candidate_matches(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  position_id uuid NOT NULL
    REFERENCES public.positions(id) ON DELETE CASCADE,
  candidate_profile_id uuid NOT NULL
    REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  application_id uuid
    REFERENCES public.applications(id) ON DELETE SET NULL,

  status public.hire_status NOT NULL DEFAULT 'offer_drafted',
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Offer terms
  salary_amount numeric(14,2),
  salary_currency text,
  salary_period text, -- 'year','month','hour'
  bonus_notes text,
  equity_notes text,
  start_date date,
  employment_type text,
  work_model text,
  location text,
  offer_notes text,

  -- Lifecycle timestamps
  drafted_at timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  hired_at timestamptz,
  closed_at timestamptz,

  -- Close reason (used on declined / closed_lost)
  close_reason public.hire_close_reason,
  close_reason_notes text,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX hire_records_org_idx    ON public.hire_records (organization_id, status, updated_at DESC);
CREATE INDEX hire_records_position_idx ON public.hire_records (position_id, status);
CREATE INDEX hire_records_owner_idx    ON public.hire_records (owner_user_id) WHERE owner_user_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hire_records TO authenticated;
GRANT ALL ON public.hire_records TO service_role;

ALTER TABLE public.hire_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_read"
  ON public.hire_records FOR SELECT
  TO authenticated
  USING (
    is_active_user(auth.uid())
    AND (is_platform_staff(auth.uid()) OR is_org_viewer(auth.uid(), organization_id))
  );

CREATE POLICY "hr_write"
  ON public.hire_records FOR INSERT
  TO authenticated
  WITH CHECK (
    is_active_user(auth.uid())
    AND (is_platform_staff(auth.uid()) OR is_org_editor(auth.uid(), organization_id))
  );

CREATE POLICY "hr_update"
  ON public.hire_records FOR UPDATE
  TO authenticated
  USING (
    is_active_user(auth.uid())
    AND (is_platform_staff(auth.uid()) OR is_org_editor(auth.uid(), organization_id))
  )
  WITH CHECK (
    is_platform_staff(auth.uid()) OR is_org_editor(auth.uid(), organization_id)
  );

CREATE POLICY "hr_delete"
  ON public.hire_records FOR DELETE
  TO authenticated
  USING (
    is_active_user(auth.uid())
    AND (is_platform_staff(auth.uid()) OR is_org_admin(auth.uid(), organization_id))
  );

CREATE TRIGGER hire_records_touch
  BEFORE UPDATE ON public.hire_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TRIGGER audit_hire_records
  AFTER INSERT OR UPDATE OR DELETE ON public.hire_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_write_audit_event();

-- Trigger: enforce valid state transitions and auto-stamp lifecycle timestamps
CREATE OR REPLACE FUNCTION public.tg_hire_records_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  o text := COALESCE(OLD.status::text, '');
  n text := NEW.status::text;
  allowed boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Any starting status is fine; timestamps stamped below
    NULL;
  ELSIF o <> n THEN
    allowed := CASE
      WHEN o = 'offer_drafted'  AND n IN ('offer_sent','closed_lost') THEN true
      WHEN o = 'offer_sent'     AND n IN ('offer_accepted','offer_declined','closed_lost') THEN true
      WHEN o = 'offer_accepted' AND n IN ('hire_confirmed','closed_lost') THEN true
      WHEN o = 'offer_declined' AND n IN ('offer_drafted','closed_lost') THEN true
      WHEN o = 'hire_confirmed' AND n IN ('closed_lost') THEN true
      WHEN o = 'closed_lost'    AND n IN ('offer_drafted') THEN true
      ELSE false
    END;
    IF NOT allowed THEN
      RAISE EXCEPTION 'invalid_hire_transition: % -> %', o, n
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Auto-stamp lifecycle timestamps
  IF NEW.status = 'offer_drafted'  AND NEW.drafted_at  IS NULL THEN NEW.drafted_at  = now(); END IF;
  IF NEW.status = 'offer_sent'     AND NEW.sent_at     IS NULL THEN NEW.sent_at     = now(); END IF;
  IF NEW.status = 'offer_accepted' AND NEW.accepted_at IS NULL THEN NEW.accepted_at = now(); END IF;
  IF NEW.status = 'offer_declined' AND NEW.declined_at IS NULL THEN NEW.declined_at = now(); END IF;
  IF NEW.status = 'hire_confirmed' AND NEW.hired_at    IS NULL THEN NEW.hired_at    = now(); END IF;
  IF NEW.status = 'closed_lost'    AND NEW.closed_at   IS NULL THEN NEW.closed_at   = now(); END IF;

  IF (NEW.status = 'offer_declined' OR NEW.status = 'closed_lost')
     AND NEW.close_reason IS NULL THEN
    RAISE EXCEPTION 'close_reason_required: status % requires close_reason', NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $fn$;

CREATE TRIGGER hire_records_lifecycle
  BEFORE INSERT OR UPDATE ON public.hire_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_hire_records_lifecycle();

-- When a hire is confirmed, sync the candidate_matches.stage to 'hired'
CREATE OR REPLACE FUNCTION public.tg_hire_records_sync_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.status = 'hire_confirmed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'hire_confirmed') THEN
    UPDATE public.candidate_matches
       SET stage = 'hired'
     WHERE id = NEW.candidate_match_id
       AND stage <> 'hired';
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER hire_records_sync_match
  AFTER INSERT OR UPDATE ON public.hire_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_hire_records_sync_match();

-- Time-to-hire view: days from application applied_at to hire_records.hired_at.
CREATE OR REPLACE VIEW public.v_time_to_hire
WITH (security_invoker = true)
AS
SELECT
  h.id                       AS hire_record_id,
  h.organization_id,
  h.position_id,
  p.title                    AS position_title,
  h.candidate_profile_id,
  cp.full_name               AS candidate_name,
  h.owner_user_id,
  a.applied_at,
  h.sent_at                  AS offer_sent_at,
  h.accepted_at              AS offer_accepted_at,
  h.hired_at,
  CASE
    WHEN h.hired_at IS NOT NULL AND a.applied_at IS NOT NULL
      THEN GREATEST(0, EXTRACT(EPOCH FROM (h.hired_at - a.applied_at)) / 86400.0)
    ELSE NULL
  END                        AS days_to_hire,
  CASE
    WHEN h.sent_at IS NOT NULL AND h.accepted_at IS NOT NULL
      THEN GREATEST(0, EXTRACT(EPOCH FROM (h.accepted_at - h.sent_at)) / 86400.0)
    ELSE NULL
  END                        AS days_offer_to_accept,
  h.status,
  h.close_reason
FROM public.hire_records h
JOIN public.positions p ON p.id = h.position_id
JOIN public.candidate_profiles cp ON cp.id = h.candidate_profile_id
LEFT JOIN public.applications a ON a.id = h.application_id;

GRANT SELECT ON public.v_time_to_hire TO authenticated;
GRANT SELECT ON public.v_time_to_hire TO service_role;

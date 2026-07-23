
-- 1. Extend position_status enum (idempotent)
DO $$ BEGIN
  ALTER TYPE public.position_status ADD VALUE IF NOT EXISTS 'under_review' AFTER 'submitted';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.position_status ADD VALUE IF NOT EXISTS 'filled' AFTER 'paused';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Openings column for multi-hire positions
ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS openings integer NOT NULL DEFAULT 1
  CHECK (openings >= 1 AND openings <= 999);

-- 3. Lifecycle transition guard
CREATE OR REPLACE FUNCTION public.tg_positions_lifecycle_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  allowed boolean := false;
  o text := OLD.status::text;
  n text := NEW.status::text;
BEGIN
  IF o = n THEN
    RETURN NEW;
  END IF;

  -- Allowed transitions (state machine)
  allowed := CASE
    WHEN o = 'draft'                AND n IN ('submitted','archived') THEN true
    WHEN o = 'submitted'            AND n IN ('under_review','needs_clarification','approved','archived') THEN true
    WHEN o = 'under_review'         AND n IN ('approved','needs_clarification','archived') THEN true
    WHEN o = 'needs_clarification'  AND n IN ('submitted','under_review','approved','archived') THEN true
    WHEN o = 'approved'             AND n IN ('active','archived') THEN true
    WHEN o = 'active'               AND n IN ('paused','filled','closed','archived') THEN true
    WHEN o = 'paused'               AND n IN ('active','closed','archived') THEN true
    WHEN o = 'filled'               AND n IN ('active','closed','archived') THEN true
    WHEN o = 'closed'               AND n IN ('active','archived') THEN true
    WHEN o = 'archived'             THEN false
    ELSE false
  END;

  IF NOT allowed THEN
    RAISE EXCEPTION 'invalid_position_transition: % -> %', o, n
      USING ERRCODE = 'check_violation';
  END IF;

  -- Approval completeness gate
  IF n = 'approved' THEN
    IF COALESCE(char_length(NEW.description), 0) < 40 THEN
      RAISE EXCEPTION 'approval_blocked: description must be at least 40 characters'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.requirements IS NULL
       OR jsonb_typeof(NEW.requirements) <> 'array'
       OR jsonb_array_length(NEW.requirements) = 0 THEN
      RAISE EXCEPTION 'approval_blocked: at least one requirement is required'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_positions_lifecycle_guard ON public.positions;
CREATE TRIGGER trg_positions_lifecycle_guard
  BEFORE UPDATE OF status ON public.positions
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_positions_lifecycle_guard();

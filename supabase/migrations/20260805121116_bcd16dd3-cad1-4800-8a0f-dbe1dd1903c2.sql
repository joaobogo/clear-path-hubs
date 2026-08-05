ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS closure_reason text,
  ADD COLUMN IF NOT EXISTS closure_note text,
  ADD COLUMN IF NOT EXISTS closed_by uuid,
  ADD COLUMN IF NOT EXISTS restart_expected_on date;

ALTER TABLE public.positions
  DROP CONSTRAINT IF EXISTS positions_closure_reason_check;
ALTER TABLE public.positions
  ADD CONSTRAINT positions_closure_reason_check CHECK (
    closure_reason IS NULL OR closure_reason IN (
      'hired_through_taasflow','hired_elsewhere','on_hold','cancelled','budget_withdrawn'
    )
  );

CREATE INDEX IF NOT EXISTS positions_closure_reason_idx
  ON public.positions (organization_id, closure_reason)
  WHERE closure_reason IS NOT NULL;
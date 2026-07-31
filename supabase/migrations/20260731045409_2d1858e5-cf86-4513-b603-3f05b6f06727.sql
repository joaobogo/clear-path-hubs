CREATE OR REPLACE FUNCTION public.enforce_position_payment_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _paid boolean;
BEGIN
  IF NEW.status IN ('approved'::position_status, 'active'::position_status)
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN

    _paid := COALESCE(NEW.payment_status::text, 'unpaid') IN ('paid', 'exempt');

    IF NOT _paid THEN
      RAISE EXCEPTION 'This role cannot be published until payment is complete. Your brief is saved as a draft — finish checkout and it will go live automatically.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_positions_payment_gate ON public.positions;

CREATE TRIGGER trg_positions_payment_gate
BEFORE INSERT OR UPDATE ON public.positions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_position_payment_gate();
CREATE OR REPLACE FUNCTION public.enforce_position_payment_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('approved','active')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
     AND COALESCE(NEW.payment_status, 'unpaid') NOT IN ('paid','exempt')
  THEN
    RAISE EXCEPTION 'This role can''t be published until payment is complete. Finish checkout for "%" and it will go live automatically.', COALESCE(NEW.title, 'this role')
      USING ERRCODE = 'check_violation', HINT = 'position_payment_required';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS positions_require_payment_to_publish ON public.positions;
CREATE TRIGGER positions_require_payment_to_publish
BEFORE INSERT OR UPDATE OF status, payment_status ON public.positions
FOR EACH ROW EXECUTE FUNCTION public.enforce_position_payment_gate();
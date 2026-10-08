-- Approval is separate from activation. Only a verified platform admin may
-- approve an unpaid role; activation retains the existing payment gate.
-- Rollback: replace the inner admin exemption with the original unconditional
-- payment check for both approved and active transitions.
CREATE OR REPLACE FUNCTION public.enforce_position_payment_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _paid boolean;
BEGIN
  IF NEW.status IN ('approved'::position_status, 'active'::position_status)
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.status = 'approved'::position_status
       AND public.is_platform_admin(auth.uid()) THEN
      RETURN NEW;
    END IF;

    _paid := COALESCE(NEW.payment_status::text, 'unpaid') IN ('paid', 'exempt', 'covered');
    IF NOT _paid THEN
      RAISE EXCEPTION 'This role cannot be published until payment is complete. Your brief is saved as a draft — finish checkout and it will go live automatically.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
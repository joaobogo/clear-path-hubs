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
    NULL;
  ELSIF o <> n THEN
    allowed := CASE
      WHEN o = 'offer_drafted'     AND n IN ('offer_sent','closed_lost') THEN true
      WHEN o = 'offer_sent'        AND n IN ('offer_negotiating','offer_accepted','offer_declined','closed_lost') THEN true
      WHEN o = 'offer_negotiating' AND n IN ('offer_sent','offer_accepted','offer_declined','closed_lost') THEN true
      WHEN o = 'offer_accepted'    AND n IN ('hire_confirmed','closed_lost') THEN true
      WHEN o = 'offer_declined'    AND n IN ('offer_drafted','closed_lost') THEN true
      WHEN o = 'hire_confirmed'    AND n IN ('closed_lost') THEN true
      WHEN o = 'closed_lost'       AND n IN ('offer_drafted') THEN true
      ELSE false
    END;
    IF NOT allowed THEN
      RAISE EXCEPTION 'invalid_hire_transition: % -> %', o, n
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.status = 'offer_drafted'     AND NEW.drafted_at     IS NULL THEN NEW.drafted_at     = now(); END IF;
  IF NEW.status = 'offer_sent'        AND NEW.sent_at        IS NULL THEN NEW.sent_at        = now(); END IF;
  IF NEW.status = 'offer_negotiating' AND NEW.negotiating_at IS NULL THEN NEW.negotiating_at = now(); END IF;
  IF NEW.status = 'offer_accepted'    AND NEW.accepted_at    IS NULL THEN NEW.accepted_at    = now(); END IF;
  IF NEW.status = 'offer_declined'    AND NEW.declined_at    IS NULL THEN NEW.declined_at    = now(); END IF;
  IF NEW.status = 'hire_confirmed'    AND NEW.hired_at       IS NULL THEN NEW.hired_at       = now(); END IF;
  IF NEW.status = 'closed_lost'       AND NEW.closed_at      IS NULL THEN NEW.closed_at      = now(); END IF;

  IF (NEW.status = 'offer_declined' OR NEW.status = 'closed_lost')
     AND NEW.close_reason IS NULL THEN
    RAISE EXCEPTION 'close_reason_required: status % requires close_reason', NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END
$fn$;
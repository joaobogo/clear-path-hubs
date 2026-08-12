CREATE OR REPLACE FUNCTION public.assign_position_reference_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr text := to_char(coalesce(NEW.created_at, now()), 'YYYY');
  next_n int;
  candidate text;
BEGIN
  IF NEW.reference_code IS NOT NULL AND btrim(NEW.reference_code) <> '' THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(max((regexp_match(reference_code, '^REQ-' || yr || '-(\d+)$'))[1]::int), 0) + 1
    INTO next_n
    FROM public.positions
   WHERE organization_id = NEW.organization_id
     AND reference_code ~ ('^REQ-' || yr || '-\d+$');

  LOOP
    candidate := 'REQ-' || yr || '-' || lpad(next_n::text, 3, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.positions
       WHERE organization_id = NEW.organization_id
         AND lower(reference_code) = lower(candidate)
    );
    next_n := next_n + 1;
  END LOOP;

  NEW.reference_code := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS positions_assign_reference_code ON public.positions;
CREATE TRIGGER positions_assign_reference_code
BEFORE INSERT ON public.positions
FOR EACH ROW EXECUTE FUNCTION public.assign_position_reference_code();

-- Backfill existing roles that have no reference ID.
DO $$
DECLARE
  r record;
  yr text;
  next_n int;
  candidate text;
BEGIN
  FOR r IN
    SELECT id, organization_id, created_at
      FROM public.positions
     WHERE reference_code IS NULL OR btrim(reference_code) = ''
     ORDER BY organization_id, created_at
  LOOP
    yr := to_char(coalesce(r.created_at, now()), 'YYYY');
    SELECT coalesce(max((regexp_match(reference_code, '^REQ-' || yr || '-(\d+)$'))[1]::int), 0) + 1
      INTO next_n
      FROM public.positions
     WHERE organization_id = r.organization_id
       AND reference_code ~ ('^REQ-' || yr || '-\d+$');
    LOOP
      candidate := 'REQ-' || yr || '-' || lpad(next_n::text, 3, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.positions
         WHERE organization_id = r.organization_id
           AND lower(reference_code) = lower(candidate)
      );
      next_n := next_n + 1;
    END LOOP;
    UPDATE public.positions SET reference_code = candidate WHERE id = r.id;
  END LOOP;
END $$;
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_pilot_position_id_fkey;

CREATE OR REPLACE FUNCTION public.tg_clear_pilot_position_ref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.organizations
     SET pilot_position_id = NULL
   WHERE pilot_position_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS positions_clear_pilot_ref ON public.positions;
CREATE TRIGGER positions_clear_pilot_ref
  BEFORE DELETE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.tg_clear_pilot_position_ref();

COMMENT ON COLUMN public.organizations.pilot_position_id IS 'Role used for the one-time pilot. Intentionally not a foreign key: a second FK to positions makes PostgREST embeds ambiguous. Cleared by trigger when the position is deleted.';
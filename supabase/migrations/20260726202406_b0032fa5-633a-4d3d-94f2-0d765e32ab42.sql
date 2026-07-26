GRANT SELECT ON public.position_locations TO anon;

DROP POLICY IF EXISTS "position_locations_public_read" ON public.position_locations;
CREATE POLICY "position_locations_public_read"
  ON public.position_locations FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.positions p
    WHERE p.id = position_locations.position_id
      AND p.visibility = 'public'
      AND p.status IN ('active','paused')
  ));
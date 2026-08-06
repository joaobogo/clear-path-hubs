-- The public board embedded organizations(name) through the anon role, which has
-- no read access to organizations (by design — the client list is private), so
-- the board 500'd. This definer lookup returns employer identity only for
-- positions that are genuinely public + active, one call for the whole page.
CREATE OR REPLACE FUNCTION public.public_position_employers(_ids uuid[])
RETURNS TABLE (position_id uuid, name text, logo_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT p.id, o.name, o.logo_url
  FROM public.positions p
  JOIN public.organizations o ON o.id = p.organization_id
  WHERE p.id = ANY(_ids)
    AND p.visibility = 'public'
    AND p.status IN ('active', 'paused')
$$;

REVOKE ALL ON FUNCTION public.public_position_employers(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_position_employers(uuid[]) TO anon, authenticated, service_role;

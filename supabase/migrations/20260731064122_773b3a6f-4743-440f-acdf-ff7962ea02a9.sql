CREATE OR REPLACE FUNCTION public._authz_probe_visible(_table text, _user uuid, _filter text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  quals text;
  sql text;
  n bigint;
BEGIN
  SELECT string_agg('(' || pg_get_expr(p.polqual, p.polrelid) || ')', ' OR ')
    INTO quals
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'public'
     AND c.relname = _table
     AND p.polcmd IN ('r', '*')
     AND (p.polroles = '{0}'::oid[]
          OR 'authenticated'::regrole = ANY (p.polroles));

  IF quals IS NULL THEN
    RETURN 0;
  END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _user::text, 'role', 'authenticated')::text, true);

  sql := format('SELECT count(*) FROM public.%I WHERE (%s) AND (%s)',
                _table, quals, replace(_filter, 't.', ''));
  EXECUTE sql INTO n;

  PERFORM set_config('request.jwt.claims', '', true);
  RETURN n;
END $function$;

REVOKE ALL ON FUNCTION public._authz_probe_visible(text, uuid, text) FROM PUBLIC, anon, authenticated;
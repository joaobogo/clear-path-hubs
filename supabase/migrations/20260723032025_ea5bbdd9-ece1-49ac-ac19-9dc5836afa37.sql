-- Gate all org-membership helpers on the organization not being archived.
-- This ensures archiving an organization revokes all member access immediately.

CREATE OR REPLACE FUNCTION public.has_org_role(_user uuid, _org uuid, _roles public.membership_role[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.organizations o ON o.id = m.organization_id
    WHERE m.user_id = _user
      AND m.organization_id = _org
      AND m.status = 'active'
      AND m.role = ANY(_roles)
      AND o.archived_at IS NULL
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_org_member(_user uuid, _org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.organizations o ON o.id = m.organization_id
    WHERE m.user_id = _user
      AND m.organization_id = _org
      AND m.status = 'active'
      AND o.archived_at IS NULL
  )
$function$;
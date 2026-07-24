
CREATE OR REPLACE FUNCTION public.grant_platform_admin_for_taasflow_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := 'f55e9b3b-75a8-486e-ab66-c496adcdfc89';
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(split_part(NEW.email, '@', 2)) = 'taasflow.com' THEN
    INSERT INTO public.memberships (user_id, organization_id, role, status)
    VALUES (NEW.id, v_org, 'platform_admin', 'active')
    ON CONFLICT (user_id, organization_id, role) DO UPDATE
      SET status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_taasflow_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_taasflow_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_platform_admin_for_taasflow_domain();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_grant_taasflow_admin ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_grant_taasflow_admin
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_platform_admin_for_taasflow_domain();

INSERT INTO public.memberships (user_id, organization_id, role, status)
SELECT u.id, 'f55e9b3b-75a8-486e-ab66-c496adcdfc89'::uuid, 'platform_admin', 'active'
FROM auth.users u
WHERE u.email_confirmed_at IS NOT NULL
  AND lower(split_part(u.email, '@', 2)) = 'taasflow.com'
ON CONFLICT (user_id, organization_id, role) DO UPDATE
  SET status = 'active';

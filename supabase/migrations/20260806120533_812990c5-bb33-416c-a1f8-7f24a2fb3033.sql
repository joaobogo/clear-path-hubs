DROP TRIGGER IF EXISTS on_auth_user_created_grant_taasflow_admin ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_confirmed_grant_taasflow_admin ON auth.users;
DROP FUNCTION IF EXISTS public.grant_platform_admin_for_taasflow_domain();
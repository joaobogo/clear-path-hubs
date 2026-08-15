REVOKE EXECUTE ON FUNCTION public.sweep_expired_support_sessions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_expired_support_sessions() TO service_role;

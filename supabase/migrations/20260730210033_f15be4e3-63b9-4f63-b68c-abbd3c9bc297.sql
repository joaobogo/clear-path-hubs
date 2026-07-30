DROP POLICY IF EXISTS retention_read_all ON public.retention_policies;
CREATE POLICY retention_staff_read ON public.retention_policies
  FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));

REVOKE ALL ON public.retention_policies FROM anon;
REVOKE ALL ON public.notification_events FROM anon;
REVOKE ALL ON public.notifications FROM anon;
REVOKE ALL ON public.messages FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.retention_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.retention_policies TO service_role;
GRANT ALL ON public.notification_events TO service_role;
GRANT ALL ON public.notifications TO service_role;
GRANT ALL ON public.messages TO service_role;
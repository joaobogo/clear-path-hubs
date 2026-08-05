CREATE TABLE IF NOT EXISTS public.notification_suppressions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email citext NOT NULL,
  reason text,
  source text NOT NULL DEFAULT 'manual',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  released_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_suppressions_active
  ON public.notification_suppressions (email) WHERE released_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.notification_suppressions TO authenticated;
GRANT ALL ON public.notification_suppressions TO service_role;

ALTER TABLE public.notification_suppressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_suppression_staff_read" ON public.notification_suppressions;
CREATE POLICY "notif_suppression_staff_read" ON public.notification_suppressions
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));

DROP POLICY IF EXISTS "notif_suppression_staff_write" ON public.notification_suppressions;
CREATE POLICY "notif_suppression_staff_write" ON public.notification_suppressions
  FOR INSERT TO authenticated WITH CHECK (public.is_platform_staff(auth.uid()));

DROP POLICY IF EXISTS "notif_suppression_staff_update" ON public.notification_suppressions;
CREATE POLICY "notif_suppression_staff_update" ON public.notification_suppressions
  FOR UPDATE TO authenticated USING (public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_platform_staff(auth.uid()));
CREATE TABLE IF NOT EXISTS public.bulk_action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '1 hour',
  executed_at timestamptz,
  result jsonb
);

GRANT SELECT ON public.bulk_action_plans TO authenticated;
GRANT ALL ON public.bulk_action_plans TO service_role;

ALTER TABLE public.bulk_action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bulk_action_plans_read_own_staff"
ON public.bulk_action_plans
FOR SELECT
TO authenticated
USING (actor_user_id = auth.uid() AND public.is_platform_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS bulk_action_plans_actor_idx
ON public.bulk_action_plans (actor_user_id, created_at DESC);
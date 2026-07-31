ALTER TABLE public.client_decisions
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS from_stage text;

CREATE INDEX IF NOT EXISTS client_decisions_active_idx
  ON public.client_decisions (organization_id, actor_user_id, created_at DESC)
  WHERE reversed_at IS NULL;

CREATE INDEX IF NOT EXISTS saved_views_default_idx
  ON public.saved_views (user_id, surface)
  WHERE is_default;
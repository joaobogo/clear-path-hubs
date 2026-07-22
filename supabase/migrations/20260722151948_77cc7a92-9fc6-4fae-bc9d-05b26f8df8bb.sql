
-- Extend support_sessions with the columns needed for admin "view-as-client"
-- support (§4, §6): mode, organization_id, permission_preview. Existing rows
-- default mode='read_only' and permission_preview='client_admin'; org can be
-- backfilled later if needed. reason keeps NOT NULL but gets a default so
-- read-only sessions never need one, matching spec §5.

ALTER TABLE public.support_sessions
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'read_only' CHECK (mode IN ('read_only','interactive')),
  ADD COLUMN IF NOT EXISTS permission_preview text NOT NULL DEFAULT 'client_admin' CHECK (permission_preview IN ('client_admin','client_editor','client_viewer'));

ALTER TABLE public.support_sessions ALTER COLUMN reason SET DEFAULT 'Support view session';

CREATE INDEX IF NOT EXISTS support_sessions_org_active_idx
  ON public.support_sessions (organization_id, actor_user_id)
  WHERE ended_at IS NULL;

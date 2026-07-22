
-- Add master admin designation
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS is_master_admin boolean NOT NULL DEFAULT false;

-- Prevent duplicate active memberships for same (user, org, role)
CREATE UNIQUE INDEX IF NOT EXISTS memberships_active_user_org_role_uidx
  ON public.memberships (user_id, organization_id, role)
  WHERE status = 'active';

-- Enforce at most one master admin globally
CREATE UNIQUE INDEX IF NOT EXISTS memberships_single_master_admin_uidx
  ON public.memberships ((true))
  WHERE is_master_admin = true AND status = 'active';

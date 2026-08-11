-- Fix: global (organization_id IS NULL) opt-out rows were readable by ANY authenticated
-- user because the USING clause short-circuited on `organization_id IS NULL`.
-- These rows can contain candidate contact addresses, so restrict them to platform staff.
-- Rollback: drop the policy below and recreate the previous definition:
--   USING ((organization_id IS NULL) OR is_org_member(auth.uid(), organization_id) OR is_platform_staff(auth.uid()))
DROP POLICY IF EXISTS "outreach_opt_outs_org_read" ON public.outreach_opt_outs;

CREATE POLICY "outreach_opt_outs_org_read"
ON public.outreach_opt_outs
FOR SELECT
TO authenticated
USING (
  is_platform_staff(auth.uid())
  OR (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
);
-- Cross-tenant write injection: cd_editor_write and hr_write checked only that the actor
-- is an editor of the organization_id supplied in the NEW row, never that
-- candidate_match_id belongs to that organization. An org editor could therefore attach a
-- decision or a hire record to another tenant's match while claiming their own org.
-- Mirrors the existing match_in_org() guard already used by evidence_overrides.
-- Both candidate_match_id and organization_id are NOT NULL on both tables, so the added
-- predicate needs no null handling.
-- Rollback: drop each policy and recreate it without the match_in_org(...) conjunct.
DROP POLICY IF EXISTS "cd_editor_write" ON public.client_decisions;
CREATE POLICY "cd_editor_write"
ON public.client_decisions
FOR INSERT
TO authenticated
WITH CHECK (
  is_active_user(auth.uid())
  AND (is_platform_staff(auth.uid()) OR is_org_editor(auth.uid(), organization_id))
  AND match_in_org(candidate_match_id, organization_id)
);

DROP POLICY IF EXISTS "hr_write" ON public.hire_records;
CREATE POLICY "hr_write"
ON public.hire_records
FOR INSERT
TO authenticated
WITH CHECK (
  is_active_user(auth.uid())
  AND (is_platform_staff(auth.uid()) OR is_org_editor(auth.uid(), organization_id))
  AND match_in_org(candidate_match_id, organization_id)
);
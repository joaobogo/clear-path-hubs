-- Tenant-scope INSERTs on public.messages.
-- Convention (see src/lib/admin.functions.ts, client.functions.ts): thread_id = organization_id.
DROP POLICY IF EXISTS messages_insert ON public.messages;

CREATE POLICY messages_insert ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_user_id = auth.uid()
  AND (
    public.is_platform_staff(auth.uid())
    OR public.is_org_editor(auth.uid(), thread_id)
  )
);
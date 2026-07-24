DROP POLICY IF EXISTS "editors insert role memory" ON public.role_memory;
DROP POLICY IF EXISTS "org members read role memory" ON public.role_memory;

CREATE POLICY "editors insert role memory"
ON public.role_memory
FOR INSERT
TO authenticated
WITH CHECK (
  (author_user_id = auth.uid())
  AND (
    public.is_platform_staff(auth.uid())
    OR public.is_org_member(auth.uid(), organization_id)
  )
);

CREATE POLICY "org members read role memory"
ON public.role_memory
FOR SELECT
TO authenticated
USING (
  public.is_platform_staff(auth.uid())
  OR public.is_org_member(auth.uid(), organization_id)
);

DROP POLICY IF EXISTS "messages_insert" ON public.messages;

CREATE POLICY "messages_insert"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (sender_user_id = auth.uid())
  AND (
    public.is_platform_staff(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.assistant_conversations c
      WHERE c.id = thread_id
        AND public.is_org_editor(auth.uid(), c.organization_id)
    )
  )
);

-- Helper: is the caller a platform_admin anywhere (any org membership)
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user AND status = 'active' AND role = 'platform_admin'
  )
$$;
REVOKE ALL ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated, service_role;

-- Update assistant_conversations policies to also allow platform admins
DROP POLICY IF EXISTS "Users read own assistant conversations in their org" ON public.assistant_conversations;
DROP POLICY IF EXISTS "Users create own assistant conversations in their org" ON public.assistant_conversations;
DROP POLICY IF EXISTS "Users update own assistant conversations" ON public.assistant_conversations;
DROP POLICY IF EXISTS "Users delete own assistant conversations" ON public.assistant_conversations;

CREATE POLICY "assistant_conversations_select"
  ON public.assistant_conversations FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_admin(auth.uid())));

CREATE POLICY "assistant_conversations_insert"
  ON public.assistant_conversations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_admin(auth.uid())));

CREATE POLICY "assistant_conversations_update"
  ON public.assistant_conversations FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_admin(auth.uid())))
  WITH CHECK (user_id = auth.uid() AND (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_admin(auth.uid())));

CREATE POLICY "assistant_conversations_delete"
  ON public.assistant_conversations FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_admin(auth.uid())));

-- Same for assistant_messages
DROP POLICY IF EXISTS "Users read own assistant messages" ON public.assistant_messages;
DROP POLICY IF EXISTS "Users insert own assistant messages" ON public.assistant_messages;
DROP POLICY IF EXISTS "Users delete own assistant messages" ON public.assistant_messages;

CREATE POLICY "assistant_messages_select"
  ON public.assistant_messages FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_admin(auth.uid())));

CREATE POLICY "assistant_messages_insert"
  ON public.assistant_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_admin(auth.uid())));

CREATE POLICY "assistant_messages_delete"
  ON public.assistant_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_admin(auth.uid())));

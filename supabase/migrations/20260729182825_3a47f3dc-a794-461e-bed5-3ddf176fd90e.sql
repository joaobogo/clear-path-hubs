-- 1. Scope policies to authenticated role -----------------------------------

DROP POLICY IF EXISTS cn_client_read ON public.candidate_notes;
CREATE POLICY cn_client_read ON public.candidate_notes
FOR SELECT TO authenticated
USING (
  (visibility = 'client_visible'::text)
  AND is_active_user(auth.uid())
  AND EXISTS (
    SELECT 1 FROM candidate_matches m
    WHERE m.id = candidate_notes.candidate_match_id
      AND m.client_visibility = 'visible'::client_visibility
      AND m.canonical_state = 'published_to_client'::canonical_scoring_state
      AND has_client_permission(auth.uid(), m.organization_id, 'view_candidates'::client_permission)
  )
);

DROP POLICY IF EXISTS cn_staff ON public.candidate_notes;
CREATE POLICY cn_staff ON public.candidate_notes
FOR ALL TO authenticated
USING (is_platform_staff(auth.uid()))
WITH CHECK (is_platform_staff(auth.uid()));

DROP POLICY IF EXISTS admin_copilot_convo_owner ON public.admin_copilot_conversations;
CREATE POLICY admin_copilot_convo_owner ON public.admin_copilot_conversations
FOR ALL TO authenticated
USING (auth.uid() = user_id AND is_platform_staff(auth.uid()))
WITH CHECK (auth.uid() = user_id AND is_platform_staff(auth.uid()));

DROP POLICY IF EXISTS admin_copilot_msgs_owner ON public.admin_copilot_messages;
CREATE POLICY admin_copilot_msgs_owner ON public.admin_copilot_messages
FOR ALL TO authenticated
USING (auth.uid() = user_id AND is_platform_staff(auth.uid()))
WITH CHECK (auth.uid() = user_id AND is_platform_staff(auth.uid()));

DROP POLICY IF EXISTS deliv_staff_read ON public.notification_deliveries;
CREATE POLICY deliv_staff_read ON public.notification_deliveries
FOR SELECT TO authenticated
USING (is_platform_staff(auth.uid()));

DROP POLICY IF EXISTS events_staff_read ON public.notification_events;
CREATE POLICY events_staff_read ON public.notification_events
FOR SELECT TO authenticated
USING (is_platform_staff(auth.uid()));

DROP POLICY IF EXISTS notif_recipient_read ON public.notifications;
CREATE POLICY notif_recipient_read ON public.notifications
FOR SELECT TO authenticated
USING (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS notif_recipient_update ON public.notifications;
CREATE POLICY notif_recipient_update ON public.notifications
FOR UPDATE TO authenticated
USING (recipient_user_id = auth.uid())
WITH CHECK (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS notif_staff_read ON public.notifications;
CREATE POLICY notif_staff_read ON public.notifications
FOR SELECT TO authenticated
USING (is_platform_staff(auth.uid()));

-- 2. Membership self-read requires a live membership ------------------------

DROP POLICY IF EXISTS memberships_self_read ON public.memberships;
CREATE POLICY memberships_self_read ON public.memberships
FOR SELECT TO authenticated
USING (
  (user_id = auth.uid() AND status IN ('active'::membership_status, 'invited'::membership_status))
  OR is_platform_staff(auth.uid())
);

-- 3. Hide screening answer key from anonymous visitors ----------------------

REVOKE SELECT ON public.screening_questions FROM anon;
GRANT SELECT (
  id, position_id, question, answer_type, required, options,
  display_order, created_at, updated_at
) ON public.screening_questions TO anon;
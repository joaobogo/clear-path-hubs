-- A candidate has no organisation and no client conversation, so the existing
-- insert rule (staff, or an org editor on a conversation) made every candidate
-- support request fail. They may write only to the ops audience, only as
-- themselves, and only into their own personal thread (thread_id = their uid).
CREATE POLICY messages_insert_candidate_to_ops
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_user_id = auth.uid()
  AND thread_id = auth.uid()
  AND conversation_id IS NULL
  AND recipient_context->>'audience' = 'taasflow_ops'
  AND EXISTS (
    SELECT 1 FROM public.candidate_profiles cp
    WHERE cp.user_id = auth.uid()
  )
);
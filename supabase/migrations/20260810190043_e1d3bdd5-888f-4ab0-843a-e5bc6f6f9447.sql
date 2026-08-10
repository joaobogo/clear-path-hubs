-- Without this, a candidate could see only the messages they sent themselves,
-- so an ops reply in their own thread was invisible to them.
CREATE POLICY messages_select_own_candidate_thread
ON public.messages
FOR SELECT
TO authenticated
USING (
  conversation_id IS NULL
  AND thread_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.candidate_profiles cp
    WHERE cp.user_id = auth.uid()
  )
);
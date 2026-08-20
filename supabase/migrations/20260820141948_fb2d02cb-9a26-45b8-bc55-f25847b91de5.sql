CREATE OR REPLACE FUNCTION public.get_conversation_unread_counts(
  _user_id uuid,
  _conversation_ids uuid[]
)
RETURNS TABLE(
  conversation_id uuid,
  unread_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT m.conversation_id, COUNT(*)::bigint AS unread_count
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  LEFT JOIN public.conversation_reads r
    ON r.conversation_id = m.conversation_id AND r.user_id = _user_id
  WHERE m.conversation_id = ANY(_conversation_ids)
    AND m.sender_user_id IS DISTINCT FROM _user_id
    AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
  GROUP BY m.conversation_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_conversation_unread_counts(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation_unread_counts(uuid, uuid[]) TO service_role;
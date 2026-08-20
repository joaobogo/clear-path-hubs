CREATE OR REPLACE FUNCTION public.get_latest_conversation_messages(conversation_ids uuid[])
RETURNS TABLE(
  conversation_id uuid,
  id uuid,
  body text,
  created_at timestamptz,
  sender_user_id uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT ON (m.conversation_id)
    m.conversation_id,
    m.id,
    m.body,
    m.created_at,
    m.sender_user_id
  FROM public.messages m
  WHERE m.conversation_id = ANY(conversation_ids)
  ORDER BY m.conversation_id, m.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_latest_conversation_messages(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_latest_conversation_messages(uuid[]) TO service_role;

-- Remove "new message" notifications that point at conversations containing no messages.
WITH dead AS (
  SELECT n.id
  FROM public.notifications n
  CROSS JOIN LATERAL (
    SELECT (regexp_match(n.link_path, '/conversations/([0-9a-fA-F-]{36})'))[1] AS conv
  ) x
  WHERE n.event_type = 'message_sent'
    AND x.conv IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.messages m WHERE m.conversation_id = x.conv::uuid
    )
)
DELETE FROM public.notifications n USING dead d WHERE n.id = d.id;

DELETE FROM public.notification_deliveries nd
WHERE NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.id = nd.notification_id);
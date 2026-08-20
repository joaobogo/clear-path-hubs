ALTER TABLE public.conversations
  ALTER COLUMN last_message_at DROP NOT NULL,
  ALTER COLUMN last_message_at DROP DEFAULT;

UPDATE public.conversations c
SET last_message_at = NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id
);

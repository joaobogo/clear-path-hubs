
-- 1) Client assistant: proposed actions column on assistant_messages.
ALTER TABLE public.assistant_messages
  ADD COLUMN IF NOT EXISTS proposed_actions jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2) Admin copilot: conversations + messages, staff-only.
CREATE TABLE IF NOT EXISTS public.admin_copilot_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_copilot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.admin_copilot_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  tool_trace jsonb NOT NULL DEFAULT '[]'::jsonb,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  proposed_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  latency_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_copilot_msgs_convo_idx
  ON public.admin_copilot_messages(conversation_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_copilot_conversations TO authenticated;
GRANT ALL ON public.admin_copilot_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_copilot_messages TO authenticated;
GRANT ALL ON public.admin_copilot_messages TO service_role;

ALTER TABLE public.admin_copilot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_copilot_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_copilot_convo_owner" ON public.admin_copilot_conversations;
CREATE POLICY "admin_copilot_convo_owner"
  ON public.admin_copilot_conversations
  FOR ALL
  USING (auth.uid() = user_id AND public.is_platform_staff(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_platform_staff(auth.uid()));

DROP POLICY IF EXISTS "admin_copilot_msgs_owner" ON public.admin_copilot_messages;
CREATE POLICY "admin_copilot_msgs_owner"
  ON public.admin_copilot_messages
  FOR ALL
  USING (auth.uid() = user_id AND public.is_platform_staff(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_platform_staff(auth.uid()));

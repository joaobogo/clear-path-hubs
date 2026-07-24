
-- Client AI Assistant foundation
CREATE TABLE public.assistant_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Pipeline assistant',
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX assistant_conversations_org_user_idx
  ON public.assistant_conversations(organization_id, user_id, archived_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_conversations TO authenticated;
GRANT ALL ON public.assistant_conversations TO service_role;

ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own assistant conversations in their org"
  ON public.assistant_conversations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users create own assistant conversations in their org"
  ON public.assistant_conversations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users update own assistant conversations"
  ON public.assistant_conversations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users delete own assistant conversations"
  ON public.assistant_conversations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER assistant_conversations_touch
  BEFORE UPDATE ON public.assistant_conversations
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Messages
CREATE TABLE public.assistant_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.assistant_conversations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL DEFAULT '',
  tool_trace JSONB NOT NULL DEFAULT '[]'::jsonb,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  model TEXT,
  latency_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX assistant_messages_conv_idx
  ON public.assistant_messages(conversation_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.assistant_messages TO authenticated;
GRANT ALL ON public.assistant_messages TO service_role;

ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own assistant messages"
  ON public.assistant_messages FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users insert own assistant messages"
  ON public.assistant_messages FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users delete own assistant messages"
  ON public.assistant_messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id));

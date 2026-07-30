-- Unified conversation threads scoped to an organization, a role, or a candidate.
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('organization','position','candidate')),
  position_id uuid REFERENCES public.positions(id) ON DELETE CASCADE,
  candidate_match_id uuid REFERENCES public.candidate_matches(id) ON DELETE CASCADE,
  subject text,
  created_by uuid,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_scope_shape CHECK (
    (scope = 'organization' AND position_id IS NULL AND candidate_match_id IS NULL)
    OR (scope = 'position' AND position_id IS NOT NULL AND candidate_match_id IS NULL)
    OR (scope = 'candidate' AND candidate_match_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS conversations_org_unique
  ON public.conversations (organization_id) WHERE scope = 'organization';
CREATE UNIQUE INDEX IF NOT EXISTS conversations_position_unique
  ON public.conversations (position_id) WHERE scope = 'position';
CREATE UNIQUE INDEX IF NOT EXISTS conversations_candidate_unique
  ON public.conversations (candidate_match_id) WHERE scope = 'candidate';
CREATE INDEX IF NOT EXISTS conversations_org_recent
  ON public.conversations (organization_id, last_message_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_select ON public.conversations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));
CREATE POLICY conversations_insert ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));
CREATE POLICY conversations_update ON public.conversations FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

-- Per-user read state for a thread.
CREATE TABLE IF NOT EXISTS public.conversation_reads (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_reads TO authenticated;
GRANT ALL ON public.conversation_reads TO service_role;
ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversation_reads_own ON public.conversation_reads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Messages join a conversation.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS messages_conversation_idx
  ON public.messages (conversation_id, created_at);

-- Backfill: one organization-scoped conversation per legacy thread_id (= org id).
INSERT INTO public.conversations (organization_id, scope, subject, last_message_at)
SELECT o.id, 'organization', 'General', COALESCE(max(m.created_at), now())
FROM public.messages m
JOIN public.organizations o ON o.id = m.thread_id
GROUP BY o.id
ON CONFLICT DO NOTHING;

UPDATE public.messages m
SET conversation_id = c.id
FROM public.conversations c
WHERE m.conversation_id IS NULL
  AND c.scope = 'organization'
  AND c.organization_id = m.thread_id;

-- Access rules for messages follow the conversation.
DROP POLICY IF EXISTS messages_sender ON public.messages;
DROP POLICY IF EXISTS messages_insert ON public.messages;

CREATE POLICY messages_select ON public.messages FOR SELECT TO authenticated
  USING (
    sender_user_id = auth.uid()
    OR public.is_platform_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND public.is_org_member(auth.uid(), c.organization_id)
    )
  );

CREATE POLICY messages_insert ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND (
      public.is_platform_staff(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND public.is_org_editor(auth.uid(), c.organization_id)
      )
    )
  );

-- Keep thread ordering fresh.
CREATE OR REPLACE FUNCTION public.tg_conversation_touch_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.conversation_id IS NOT NULL THEN
    UPDATE public.conversations
      SET last_message_at = NEW.created_at, updated_at = now()
      WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_touch_conversation ON public.messages;
CREATE TRIGGER messages_touch_conversation
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.tg_conversation_touch_last_message();
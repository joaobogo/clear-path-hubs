
-- Phase 14: AI Permissions, Citations, and Audit
-- Add confidence + audit trail for both client assistant and admin copilot.

ALTER TABLE public.assistant_messages
  ADD COLUMN IF NOT EXISTS confidence text
    CHECK (confidence IN ('high','medium','low','none'));

ALTER TABLE public.admin_copilot_messages
  ADD COLUMN IF NOT EXISTS confidence text
    CHECK (confidence IN ('high','medium','low','none'));

CREATE TABLE IF NOT EXISTS public.assistant_audit_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surface           text NOT NULL CHECK (surface IN ('client_assistant','admin_copilot')),
  event_type        text NOT NULL CHECK (event_type IN (
                        'prompt','tool_call','action_proposed',
                        'action_executed','action_denied','action_failed',
                        'gateway_error','guardrail_missing_data'
                     )),
  user_id           uuid NOT NULL,
  organization_id   uuid,
  conversation_id   uuid,
  message_id        uuid,
  action_id         text,
  tool_name         text,
  content_preview   text,
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_audit_user_created
  ON public.assistant_audit_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_audit_org_created
  ON public.assistant_audit_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_audit_surface_type
  ON public.assistant_audit_events (surface, event_type, created_at DESC);

GRANT SELECT, INSERT ON public.assistant_audit_events TO authenticated;
GRANT ALL ON public.assistant_audit_events TO service_role;

ALTER TABLE public.assistant_audit_events ENABLE ROW LEVEL SECURITY;

-- Users can insert their own audit events (server-side always sets user_id = auth.uid()).
CREATE POLICY "assistant_audit_insert_own"
  ON public.assistant_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can read their own audit events.
CREATE POLICY "assistant_audit_select_own"
  ON public.assistant_audit_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Platform staff can read all audit events (compliance / incident review).
CREATE POLICY "assistant_audit_select_staff"
  ON public.assistant_audit_events
  FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));

-- Org admins can read audit events scoped to their org (for client_assistant surface).
CREATE POLICY "assistant_audit_select_org_admin"
  ON public.assistant_audit_events
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND public.is_org_admin(auth.uid(), organization_id)
  );

CREATE TABLE public.position_info_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  position_id uuid REFERENCES public.positions(id) ON DELETE CASCADE,
  brief_field text NOT NULL,
  question text NOT NULL,
  why_needed text,
  unblocks text,
  requested_by uuid,
  status text NOT NULL DEFAULT 'open',
  answer text,
  answered_by uuid,
  answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT position_info_requests_status_check CHECK (status IN ('open','answered','cancelled')),
  CONSTRAINT position_info_requests_question_len CHECK (char_length(question) BETWEEN 3 AND 600),
  CONSTRAINT position_info_requests_field_len CHECK (char_length(brief_field) BETWEEN 2 AND 60)
);

CREATE INDEX position_info_requests_org_open_idx
  ON public.position_info_requests (organization_id, status, created_at);
CREATE INDEX position_info_requests_position_idx
  ON public.position_info_requests (position_id, status);

GRANT SELECT, INSERT, UPDATE ON public.position_info_requests TO authenticated;
GRANT ALL ON public.position_info_requests TO service_role;

ALTER TABLE public.position_info_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "info_requests_read_own_org"
  ON public.position_info_requests FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "info_requests_staff_insert"
  ON public.position_info_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_staff(auth.uid()));

CREATE POLICY "info_requests_answer_or_staff_update"
  ON public.position_info_requests FOR UPDATE TO authenticated
  USING (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_org_editor(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE TRIGGER position_info_requests_touch_updated_at
  BEFORE UPDATE ON public.position_info_requests
  FOR EACH ROW EXECUTE FUNCTION public._mig_touch_updated_at();
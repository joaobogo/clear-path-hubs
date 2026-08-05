CREATE TABLE public.pilot_claims (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  intake_submission_id uuid REFERENCES public.intake_submissions(id) ON DELETE SET NULL,
  company_name text NOT NULL,
  company_name_normalized text NOT NULL,
  company_domain text,
  email_domain text,
  contact_email text,
  status text NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'completed', 'void')),
  blocked boolean NOT NULL DEFAULT false,
  blocked_reason text,
  matched_claim_id uuid REFERENCES public.pilot_claims(id) ON DELETE SET NULL,
  exception_granted boolean NOT NULL DEFAULT false,
  exception_kind text CHECK (exception_kind IN ('multi_location', 'franchise', 'subsidiary', 'other')),
  exception_reason text,
  exception_by uuid,
  exception_at timestamp with time zone,
  trace_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_pilot_claims_name ON public.pilot_claims (company_name_normalized);
CREATE INDEX idx_pilot_claims_company_domain ON public.pilot_claims (company_domain) WHERE company_domain IS NOT NULL;
CREATE INDEX idx_pilot_claims_email_domain ON public.pilot_claims (email_domain) WHERE email_domain IS NOT NULL;
CREATE INDEX idx_pilot_claims_org ON public.pilot_claims (organization_id);

GRANT SELECT ON public.pilot_claims TO authenticated;
GRANT ALL ON public.pilot_claims TO service_role;

ALTER TABLE public.pilot_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform staff can read pilot claims"
  ON public.pilot_claims FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));

CREATE TRIGGER pilot_claims_touch_updated_at
  BEFORE UPDATE ON public.pilot_claims
  FOR EACH ROW EXECUTE FUNCTION public.payments_touch_updated_at();
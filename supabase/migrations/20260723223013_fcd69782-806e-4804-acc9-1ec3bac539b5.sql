
CREATE TABLE public.marketing_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('call','message')),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  company text CHECK (company IS NULL OR length(company) <= 200),
  role_title text CHECK (role_title IS NULL OR length(role_title) <= 200),
  role_count text CHECK (role_count IS NULL OR length(role_count) <= 40),
  message text CHECK (message IS NULL OR length(message) <= 4000),
  industry_slug text CHECK (industry_slug IS NULL OR length(industry_slug) <= 80),
  preferred_slot timestamptz,
  source_path text CHECK (source_path IS NULL OR length(source_path) <= 300),
  user_agent text CHECK (user_agent IS NULL OR length(user_agent) <= 500),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','scheduled','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX marketing_inquiries_created_at_idx ON public.marketing_inquiries (created_at DESC);
CREATE INDEX marketing_inquiries_status_idx ON public.marketing_inquiries (status);
CREATE INDEX marketing_inquiries_industry_idx ON public.marketing_inquiries (industry_slug);

GRANT SELECT ON public.marketing_inquiries TO authenticated;
GRANT ALL ON public.marketing_inquiries TO service_role;

ALTER TABLE public.marketing_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform staff can read inquiries"
  ON public.marketing_inquiries FOR SELECT
  TO authenticated
  USING (public.is_platform_staff(auth.uid()));

CREATE POLICY "Platform admins can update inquiries"
  ON public.marketing_inquiries FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

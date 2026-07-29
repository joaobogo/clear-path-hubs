-- Positions: express onboarding + blueprint
ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS jd_source text,
  ADD COLUMN IF NOT EXISTS jd_text text,
  ADD COLUMN IF NOT EXISTS jd_file_path text,
  ADD COLUMN IF NOT EXISTS jd_file_name text,
  ADD COLUMN IF NOT EXISTS jd_file_size integer,
  ADD COLUMN IF NOT EXISTS blueprint jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS blueprint_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS blueprint_error text,
  ADD COLUMN IF NOT EXISTS blueprint_model text,
  ADD COLUMN IF NOT EXISTS blueprint_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS blueprint_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS company_research jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  ALTER TABLE public.positions
    ADD CONSTRAINT positions_blueprint_status_chk
    CHECK (blueprint_status IN (
      'not_started','queued','analyzing_jd','researching_company',
      'drafting_blueprint','ready','failed'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS positions_blueprint_status_idx
  ON public.positions (blueprint_status)
  WHERE blueprint_status <> 'not_started';

-- Organizations: pilot lifecycle (one pilot per company)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS pilot_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS pilot_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS pilot_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS pilot_position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_pilot_status_chk
    CHECK (pilot_status IN ('none','active','completed','converted'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Intake submissions: express vs full
ALTER TABLE public.intake_submissions
  ADD COLUMN IF NOT EXISTS intake_mode text NOT NULL DEFAULT 'full';

DO $$ BEGIN
  ALTER TABLE public.intake_submissions
    ADD CONSTRAINT intake_submissions_intake_mode_chk
    CHECK (intake_mode IN ('full','express'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Storage policies for the private job-descriptions bucket.
DROP POLICY IF EXISTS "jd_staff_read" ON storage.objects;
CREATE POLICY "jd_staff_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'job-descriptions' AND public.is_platform_staff(auth.uid()));

DROP POLICY IF EXISTS "jd_org_member_read" ON storage.objects;
CREATE POLICY "jd_org_member_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'job-descriptions'
    AND public.is_org_member(auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
  );
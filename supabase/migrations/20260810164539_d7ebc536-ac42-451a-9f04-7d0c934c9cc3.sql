
-- 1. Revoke privileges that RLS does NOT filter (TRUNCATE, TRIGGER, REFERENCES)
--    from public roles on every table in the public schema.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format(
      'REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.%I FROM anon, authenticated',
      r.relname);
  END LOOP;
END $$;

-- 2. Anon gets nothing by default.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', r.relname);
  END LOOP;
END $$;

-- 3. Re-grant anon read on the genuinely public surfaces only.
GRANT SELECT ON public.status_incidents TO anon;
GRANT SELECT ON public.tracking_policy  TO anon;
GRANT SELECT ON public.position_locations TO anon;

-- Job board: safe columns only. Internal commercial/scoring fields excluded.
GRANT SELECT (
  id, organization_id, title, department, location, work_model, employment_type,
  seniority, description, requirements, preferred_requirements, work_authorization,
  status, visibility, openings, business_unit, region, reference_code,
  travel_expectation, primary_timezone, timezone_overlap_hours, target_start_date,
  published_at, closed_at, created_at, updated_at, expires_at
) ON public.positions TO anon;

-- Screening questions: candidate-visible columns only.
GRANT SELECT (
  id, position_id, question, answer_type, required, options, display_order,
  why_asked, created_at, updated_at
) ON public.screening_questions TO anon;

-- 4. Close the role_memory update path that allowed moving a row to another org.
DROP POLICY IF EXISTS "authors or staff update role memory" ON public.role_memory;
CREATE POLICY "authors or staff update role memory"
ON public.role_memory
FOR UPDATE
TO authenticated
USING (
  public.is_platform_staff(auth.uid())
  OR author_user_id = auth.uid()
)
WITH CHECK (
  public.is_platform_staff(auth.uid())
  OR (
    author_user_id = auth.uid()
    AND organization_id IS NOT NULL
    AND public.is_org_member(auth.uid(), organization_id)
  )
);

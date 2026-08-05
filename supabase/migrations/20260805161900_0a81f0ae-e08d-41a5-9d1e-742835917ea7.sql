ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS completion_seconds integer
    CHECK (completion_seconds IS NULL OR (completion_seconds >= 20 AND completion_seconds <= 7200));

COMMENT ON COLUMN public.applications.completion_seconds IS
  'Wall-clock seconds between the apply form first rendering and a successful submit. Clamped; NULL when unmeasured.';

CREATE INDEX IF NOT EXISTS applications_position_completion_idx
  ON public.applications (position_id)
  WHERE completion_seconds IS NOT NULL;

CREATE OR REPLACE FUNCTION public.public_application_effort(_position_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT jsonb_build_object(
    'sample_size', count(*),
    'median_seconds',
      CASE WHEN count(*) > 0
        THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY a.completion_seconds)
        ELSE NULL END
  )
  FROM public.applications a
  JOIN public.positions p ON p.id = a.position_id
  WHERE a.position_id = _position_id
    AND a.completion_seconds IS NOT NULL
    AND a.withdrawn_at IS NULL
    AND COALESCE(a.is_test_record, false) = false
    AND p.visibility = 'public'
    AND p.status IN ('active', 'approved');
$$;

REVOKE ALL ON FUNCTION public.public_application_effort(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_application_effort(uuid) TO anon, authenticated, service_role;
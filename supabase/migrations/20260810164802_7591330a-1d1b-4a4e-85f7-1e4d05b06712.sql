
-- The board needs these three to render listings; pay display is already gated
-- server-side by compensation_visibility.
GRANT SELECT (compensation, compensation_visibility, is_test_record)
  ON public.positions TO anon;

-- Only the `posting` subtree of intake_context is public. This returns that
-- whitelist and nothing else, so anon never needs a column grant on
-- intake_context (which also holds internal hiring notes).
CREATE OR REPLACE FUNCTION public.public_position_posting(_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
           'application_deadline',   p.intake_context -> 'posting' ->> 'application_deadline',
           'confidentiality',        p.intake_context -> 'posting' ->> 'confidentiality',
           'onsite_days',            p.intake_context -> 'posting' ->  'onsite_days',
           'work_authorization_note',p.intake_context -> 'posting' ->> 'work_authorization_note'
         ))
    FROM public.positions p
   WHERE p.id = _id
     AND p.visibility = 'public'::public.position_visibility
     AND p.status IN ('active'::public.position_status, 'paused'::public.position_status)
$$;

REVOKE ALL ON FUNCTION public.public_position_posting(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_position_posting(uuid) TO anon, authenticated, service_role;

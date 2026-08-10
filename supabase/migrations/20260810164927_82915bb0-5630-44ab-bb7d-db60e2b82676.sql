
CREATE OR REPLACE FUNCTION public.public_position_posting(_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
           'application_deadline',    p.intake_context -> 'posting' ->> 'application_deadline',
           'confidentiality',         p.intake_context -> 'posting' ->> 'confidentiality',
           'onsite_days',             p.intake_context -> 'posting' ->  'onsite_days',
           'work_authorization_note', p.intake_context -> 'posting' ->> 'work_authorization_note',
           'company_intro',           p.intake_context -> 'posting' ->> 'company_intro',
           'benefits',                p.intake_context -> 'posting' ->> 'benefits',
           'languages',               p.intake_context -> 'posting' ->> 'languages',
           'travel',                  p.intake_context -> 'posting' ->> 'travel',
           'accessibility_note',      p.intake_context -> 'posting' ->> 'accessibility_note',
           'eeo_statement',           p.intake_context -> 'posting' ->> 'eeo_statement',
           'responsibilities',        p.intake_context ->> 'responsibilities'
         ))
    FROM public.positions p
   WHERE p.id = _id
     AND p.visibility = 'public'::public.position_visibility
     AND p.status IN ('active'::public.position_status, 'paused'::public.position_status)
$$;

REVOKE ALL ON FUNCTION public.public_position_posting(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_position_posting(uuid) TO anon, authenticated, service_role;

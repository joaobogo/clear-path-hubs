INSERT INTO public.position_locations (position_id, organization_id, country_code, country, region, city, work_model, is_primary, headcount, timezone, onsite_days_per_week, display_order)
VALUES ('ee6d2a82-6122-4026-95e4-45a7821b7b7d', '0c86fa1b-94ee-46b8-9a11-a42cee39bfed', 'PT', 'Portugal', 'Lisbon', 'Lisbon', 'hybrid', true, 1, 'Europe/Lisbon', 2, 0);

UPDATE public.positions
SET travel_expectation = 'Occasional travel — up to 2 trips per quarter for team onsites in Lisbon.',
    primary_timezone = COALESCE(NULLIF(primary_timezone, ''), 'Europe/Lisbon'),
    intake_context = COALESCE(intake_context, '{}'::jsonb) || jsonb_build_object(
      'interview_process', E'1. Intro call with the hiring manager (30 min)\n2. Technical deep-dive on a recent project (60 min)\n3. Practical pairing session (90 min)\n4. Final conversation with the founders (30 min)',
      'posting', COALESCE(intake_context->'posting', '{}'::jsonb) || jsonb_build_object('travel', 'Occasional travel — up to 2 trips per quarter for team onsites in Lisbon.')
    )
WHERE id = 'ee6d2a82-6122-4026-95e4-45a7821b7b7d';
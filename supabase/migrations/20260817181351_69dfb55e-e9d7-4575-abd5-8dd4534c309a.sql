GRANT SELECT ON public.candidate_matches TO authenticated;
GRANT ALL ON public.candidate_matches TO service_role;
GRANT SELECT ON public.screening_questions TO authenticated;
GRANT SELECT ON public.screening_questions TO anon;
GRANT ALL ON public.screening_questions TO service_role;
ALTER PUBLICATION supabase_realtime ADD TABLE public.candidate_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.positions;
ALTER TABLE public.candidate_matches REPLICA IDENTITY FULL;
ALTER TABLE public.positions REPLICA IDENTITY FULL;
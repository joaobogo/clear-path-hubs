REVOKE ALL ON FUNCTION public.hard_delete_position(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hard_delete_candidate_match(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hard_delete_position(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hard_delete_candidate_match(uuid, uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.hard_delete_candidate_match(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hard_delete_candidate_match(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.hard_delete_candidate_match(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.hard_delete_candidate_match(uuid, uuid, text) TO service_role;
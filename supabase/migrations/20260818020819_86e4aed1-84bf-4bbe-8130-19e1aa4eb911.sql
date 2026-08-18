DO $$
DECLARE
  v_system_actor uuid := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  UPDATE public.candidate_matches
  SET
    contact_released_at = COALESCE(
      submitted_to_client_at,
      delivered_at,
      updated_at,
      created_at
    ),
    contact_released_by = v_system_actor,
    contact_release_reason = 'Backfilled release at publish'
  WHERE
    client_visibility = 'visible'
    AND canonical_state = 'published_to_client'
    AND contact_released_at IS NULL;

  RAISE NOTICE 'Backfilled contact release for % published candidate matches.',
    (SELECT count(*) FROM public.candidate_matches
     WHERE client_visibility = 'visible'
       AND canonical_state = 'published_to_client'
       AND contact_released_at IS NOT NULL);
END $$;

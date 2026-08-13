update public.candidate_matches cm
set contact_released_at = now(),
    contact_release_reason = coalesce(contact_release_reason, 'Demo workspace: CV and contact details released for client review')
where cm.organization_id = (select id from public.organizations where name ilike '%Northwind%' limit 1)
  and cm.client_visibility = 'visible'
  and cm.canonical_state = 'published_to_client'
  and cm.contact_released_at is null;
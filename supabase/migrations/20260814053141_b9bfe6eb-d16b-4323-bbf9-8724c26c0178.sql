-- Reverts the single offline-decision row created while gating the admin
-- overview actions during stabilization pass 6. Scoped to the test-org
-- fixture match and the exact probe marker, so no client data is touched.
delete from public.client_decisions
where candidate_match_id = 'd3000000-0000-4000-8000-000000000006'
  and details->>'received_from' = 'QA Stabilization probe';
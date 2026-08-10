DROP POLICY IF EXISTS "Org members read own signals" ON public.search_signals;
CREATE POLICY "Org members read own signals"
ON public.search_signals
FOR SELECT
TO authenticated
USING (
  organization_id IS NOT NULL
  AND public.is_org_member(auth.uid(), organization_id)
  AND (
    candidate_profile_id IS NULL
    OR public.is_candidate_visible_to_org(auth.uid(), organization_id, candidate_profile_id)
  )
);

DROP POLICY IF EXISTS "Org members read own graph edges" ON public.talent_graph_edges;
CREATE POLICY "Org members read own graph edges"
ON public.talent_graph_edges
FOR SELECT
TO authenticated
USING (
  organization_id IS NOT NULL
  AND public.is_org_member(auth.uid(), organization_id)
  AND (
    candidate_profile_id IS NULL
    OR public.is_candidate_visible_to_org(auth.uid(), organization_id, candidate_profile_id)
  )
  AND (
    candidate_match_id IS NULL
    OR public.is_match_client_visible(auth.uid(), candidate_match_id)
  )
);
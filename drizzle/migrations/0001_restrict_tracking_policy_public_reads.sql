-- Publish only the singleton consent configuration, not its staff attribution.
-- Rollback: GRANT SELECT ON public.tracking_policy TO anon, authenticated;
-- ALTER POLICY "tracking policy is publicly readable" ON public.tracking_policy USING (true);
REVOKE SELECT ON public.tracking_policy FROM anon, authenticated;
GRANT SELECT (id, essential_trackers, require_prior_opt_in_everywhere, updated_at)
  ON public.tracking_policy TO anon, authenticated;
ALTER POLICY "tracking policy is publicly readable"
  ON public.tracking_policy
  TO anon, authenticated
  USING (id = true);

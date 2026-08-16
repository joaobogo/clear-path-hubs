-- Re-gate blanket (actor-less) contact releases for pre-interview candidates.
WITH regated AS (
  SELECT m.id, m.organization_id, m.contact_released_at, m.contact_release_reason
  FROM public.candidate_matches m
  WHERE m.contact_released_at IS NOT NULL
    AND m.contact_released_by IS NULL
    AND m.stage NOT IN ('interview_process', 'offer', 'hired')
    AND NOT EXISTS (
      SELECT 1 FROM public.interviews i WHERE i.candidate_match_id = m.id
    )
),
audited AS (
  INSERT INTO public.audit_events (
    actor_user_id, organization_id, entity_type, entity_id, action, before_state, after_state
  )
  SELECT
    NULL,
    r.organization_id,
    'candidate_matches',
    r.id,
    'contact_release_revoked',
    jsonb_build_object('contact_released_at', r.contact_released_at, 'contact_release_reason', r.contact_release_reason),
    jsonb_build_object(
      'contact_released_at', NULL,
      'reason', 'Re-gated by pre-interview consent policy (bulk release without a recorded actor)'
    )
  FROM regated r
  RETURNING entity_id
)
UPDATE public.candidate_matches m
SET contact_released_at = NULL,
    contact_released_by = NULL,
    contact_release_reason = NULL,
    updated_at = now()
WHERE m.id IN (SELECT entity_id FROM audited);
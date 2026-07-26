-- 1. Candidate notes: internal vs client-visible, never mixed.
CREATE TABLE IF NOT EXISTS public.candidate_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_match_id uuid NOT NULL REFERENCES public.candidate_matches(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(btrim(body)) > 0 AND length(body) <= 8000),
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','client_visible')),
  author_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS candidate_notes_match_idx
  ON public.candidate_notes (candidate_match_id, created_at DESC);

GRANT SELECT ON public.candidate_notes TO authenticated;
GRANT ALL ON public.candidate_notes TO service_role;

ALTER TABLE public.candidate_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY cn_staff ON public.candidate_notes
  FOR ALL USING (public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_platform_staff(auth.uid()));

CREATE POLICY cn_client_read ON public.candidate_notes
  FOR SELECT USING (
    visibility = 'client_visible'
    AND public.is_active_user(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.candidate_matches m
      WHERE m.id = candidate_notes.candidate_match_id
        AND m.client_visibility = 'visible'
        AND m.canonical_state = 'published_to_client'
        AND public.has_client_permission(auth.uid(), m.organization_id, 'view_candidates'::public.client_permission)
    )
  );

CREATE TRIGGER candidate_notes_touch
  BEFORE UPDATE ON public.candidate_notes
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 2. Flattened admin candidate index — one row per candidate_match.
CREATE OR REPLACE VIEW public.v_admin_candidate_index AS
SELECT
  m.id                          AS match_id,
  m.application_id,
  m.candidate_profile_id,
  m.position_id,
  m.organization_id,
  o.name                        AS org_name,
  p.title                       AS position_title,
  cp.full_name,
  cp.email,
  cp.phone,
  cp.country,
  cp.region,
  cp.city,
  cp.location,
  m.stage::text                 AS stage,
  m.admin_status::text          AS admin_status,
  m.canonical_state::text       AS canonical_state,
  m.client_visibility::text     AS client_visibility,
  m.processing_state::text      AS processing_state,
  m.eligibility_status::text    AS eligibility_status,
  m.recommendation::text        AS recommendation,
  m.integrity_status::text      AS integrity_status,
  m.evidence_confidence,
  m.contact_released_at,
  (m.contact_released_at IS NOT NULL) AS contact_released,
  m.created_at,
  m.updated_at,
  a.applied_at,
  a.source::text                AS source,
  a.source_kind::text           AS source_kind,
  a.source_channel,
  sr.id                         AS score_run_id,
  sr.score,
  sr.final_score,
  sr.fit_label::text            AS fit_label,
  sr.fit_band::text             AS fit_band,
  sr.confidence,
  sr.contradiction_status::text AS contradiction_status,
  public.score_band(COALESCE(sr.final_score, sr.score))::text AS score_band,
  (
    m.integrity_status::text <> 'ok'
    OR sr.contradiction_status::text IN ('disqualifying_answer','contradiction_found')
    OR m.eligibility_status::text = 'ineligible'
    OR m.processing_state::text IN ('failed','provider_blocked','manual_review_required','ocr_required')
  )                             AS has_critical_flag,
  lower(
    coalesce(cp.full_name,'') || ' ' || coalesce(cp.email,'') || ' ' ||
    coalesce(cp.phone,'')     || ' ' || coalesce(p.title,'')  || ' ' ||
    coalesce(o.name,'')       || ' ' || coalesce(cp.city,'')  || ' ' ||
    coalesce(cp.country,'')
  )                             AS search_text
FROM public.candidate_matches m
JOIN public.positions p          ON p.id  = m.position_id
JOIN public.organizations o      ON o.id  = m.organization_id
LEFT JOIN public.candidate_profiles cp ON cp.id = m.candidate_profile_id
LEFT JOIN public.applications a  ON a.id  = m.application_id
LEFT JOIN public.score_runs sr   ON sr.id = COALESCE(m.approved_score_run_id, m.current_score_run_id);

ALTER VIEW public.v_admin_candidate_index SET (security_invoker = on);
GRANT SELECT ON public.v_admin_candidate_index TO service_role;
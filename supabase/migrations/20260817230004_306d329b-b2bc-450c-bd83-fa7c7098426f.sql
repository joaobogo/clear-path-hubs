-- Migration: Flag QA fixture rows and expose test-record status in the admin candidate index.
-- Stabilization pass for MVP launch. Scope is limited to QA fixtures created by the QA seed
-- (names/emails/titles starting with qa, QA_*, TESTCO, OTHERCO, E2E, Walkthrough Candidate,
-- Mobile Tester, TESTRUN) and the rows that reference them. Real internal orgs
-- (BRPH, neuronflow, Flow Group Ventures, atlasflow, Bob law) and demo clients
-- (Northwind Talent) are NOT touched; only QA_* fixtures are flagged as test records.

-- 1. Flag QA organizations.
UPDATE public.organizations
   SET is_test_record = true
 WHERE is_test_record IS DISTINCT FROM true
   AND (
     name ILIKE 'QA_%'
     OR name ILIKE '%TESTCO%'
     OR name ILIKE '%OTHERCO%'
     OR name ILIKE '%E2E%'
   );

-- 2. Flag QA positions (QA titles or in any test org).
UPDATE public.positions
   SET is_test_record = true
 WHERE is_test_record IS DISTINCT FROM true
   AND (
     title ILIKE '%QA%'
     OR title ILIKE '%E2E%'
     OR organization_id IN (SELECT id FROM public.organizations WHERE is_test_record = true)
   );

-- 3. Flag QA candidate profiles.
UPDATE public.candidate_profiles
   SET is_test_record = true
 WHERE is_test_record IS DISTINCT FROM true
   AND (
     full_name ILIKE '%QA%'
     OR full_name ILIKE '%Walkthrough Candidate%'
     OR full_name ILIKE '%Mobile Tester%'
     OR email ILIKE '%qa%'
     OR email ILIKE '%testrun%'
   );

-- 4. Flag candidate_matches tied to QA positions, QA candidates, or QA orgs.
UPDATE public.candidate_matches
   SET is_test_record = true
 WHERE is_test_record IS DISTINCT FROM true
   AND (
     position_id IN (SELECT id FROM public.positions WHERE is_test_record = true)
     OR candidate_profile_id IN (SELECT id FROM public.candidate_profiles WHERE is_test_record = true)
     OR organization_id IN (SELECT id FROM public.organizations WHERE is_test_record = true)
   );

-- 5. Flag applications tied to QA positions.
UPDATE public.applications
   SET is_test_record = true
 WHERE is_test_record IS DISTINCT FROM true
   AND position_id IN (SELECT id FROM public.positions WHERE is_test_record = true);

-- 6. Recreate admin candidate index view with a single test-record flag.
DROP VIEW IF EXISTS public.v_admin_candidate_index;

CREATE VIEW public.v_admin_candidate_index AS
 SELECT m.id AS match_id,
    m.application_id,
    m.candidate_profile_id,
    m.position_id,
    m.organization_id,
    o.name AS org_name,
    p.title AS position_title,
    cp.full_name,
    cp.email,
    cp.phone,
    cp.country,
    cp.region,
    cp.city,
    cp.location,
    m.stage::text AS stage,
    m.admin_status::text AS admin_status,
    m.canonical_state::text AS canonical_state,
    m.client_visibility::text AS client_visibility,
    m.processing_state::text AS processing_state,
    m.eligibility_status::text AS eligibility_status,
    m.recommendation::text AS recommendation,
    m.integrity_status::text AS integrity_status,
    m.evidence_confidence,
    m.contact_released_at,
    m.contact_released_at IS NOT NULL AS contact_released,
    m.created_at,
    m.updated_at,
    a.applied_at,
    a.source,
    a.source_kind::text AS source_kind,
    a.source_channel,
    sr.id AS score_run_id,
    sr.score,
    sr.final_score,
    sr.fit_label,
    sr.fit_band,
    sr.confidence,
    sr.contradiction_status,
    score_band(COALESCE(sr.final_score, sr.score))::text AS score_band,
    m.integrity_status::text <> 'ok'::text OR (sr.contradiction_status = ANY (ARRAY['disqualifying_answer'::text, 'contradiction_found'::text])) OR m.eligibility_status::text = 'ineligible'::text OR (m.processing_state::text = ANY (ARRAY['failed'::text, 'provider_blocked'::text, 'manual_review_required'::text, 'ocr_required'::text])) AS has_critical_flag,
    COALESCE(m.is_test_record, false) OR COALESCE(p.is_test_record, false) OR COALESCE(o.is_test_record, false) OR COALESCE(cp.is_test_record, false) AS is_test_record,
    lower((((((((((((COALESCE(cp.full_name, ''::text) || ' '::text) || COALESCE(cp.email, ''::text)) || ' '::text) || COALESCE(cp.phone, ''::text)) || ' '::text) || COALESCE(p.title, ''::text)) || ' '::text) || COALESCE(o.name, ''::text)) || ' '::text) || COALESCE(cp.city, ''::text)) || ' '::text) || COALESCE(cp.country, ''::text)) AS search_text,
    sr.completed_at AS scored_at,
    sr.engine_version AS scored_engine_version,
    sr.input_hash AS scored_input_hash,
    cp.updated_at AS profile_updated_at,
    p.updated_at AS brief_updated_at
   FROM candidate_matches m
     JOIN positions p ON p.id = m.position_id
     JOIN organizations o ON o.id = m.organization_id
     LEFT JOIN candidate_profiles cp ON cp.id = m.candidate_profile_id
     LEFT JOIN applications a ON a.id = m.application_id
     LEFT JOIN score_runs sr ON sr.id = COALESCE(m.approved_score_run_id, m.current_score_run_id);

-- The view is queried through the service-role admin client; make sure that role can read it.
GRANT SELECT ON public.v_admin_candidate_index TO service_role;
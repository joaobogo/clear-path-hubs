-- ─────────────────────────────────────────────────────────────────────
-- Scoring-criteria confidentiality hardening.
--
-- Goal: candidates must never be able to read the criteria used to
-- evaluate them, nor internal assessment prose about themselves — not
-- through the app, and not by calling PostgREST directly with their own
-- session token.
-- ─────────────────────────────────────────────────────────────────────

-- 1. rubric_templates.blueprint holds the evaluation criteria (competencies,
--    weights, signals). The old policy let ANY authenticated user read every
--    active template, which includes candidates. No application code reads
--    this table with a user-scoped client; staff tooling uses the privileged
--    server client, which bypasses RLS. Staff-only from here.
DROP POLICY IF EXISTS "authenticated read active templates" ON public.rubric_templates;

CREATE POLICY "platform staff read templates"
  ON public.rubric_templates
  FOR SELECT
  TO authenticated
  USING (public.is_platform_staff(auth.uid()));

-- 2. candidate_matches is readable by the owning candidate (cm_candidate_own_read),
--    which is correct for status/stage but also exposed internal assessment
--    columns on that row. RLS cannot filter columns, so restrict at the
--    privilege layer: drop the blanket table-level SELECT for `authenticated`
--    and re-grant SELECT column-by-column, omitting the internal-only fields.
--
--    INSERT / UPDATE / DELETE stay at table level — RLS still decides which
--    rows, and every writer of the withheld columns uses the privileged
--    server client. All withheld columns are only ever read through
--    supabaseAdmin (admin-candidates, scoring-review, processing,
--    pipeline-runner, authz), so no user-scoped read path is affected.
REVOKE SELECT ON public.candidate_matches FROM authenticated;

GRANT SELECT (
  id,
  application_id,
  candidate_profile_id,
  position_id,
  organization_id,
  stage,
  admin_status,
  client_visibility,
  delivered_at,
  created_at,
  updated_at,
  processing_state,
  current_score_run_id,
  approved_score_run_id,
  processing_updated_at,
  is_test_record,
  test_run_id,
  created_by_audit,
  expires_at,
  legacy_source_system,
  legacy_source_table,
  legacy_source_id,
  migrated_at,
  migration_run_id,
  migration_version,
  migration_status,
  canonical_state,
  eligibility_status,
  eligibility_updated_at,
  evidence_confidence,
  recommendation,
  recommendation_updated_at,
  integrity_status,
  contact_released_at,
  contact_released_by,
  submitted_to_client_at,
  client_decision_due_at,
  current_stage_entered_at,
  score_stale,
  score_stale_reasons,
  score_stale_at,
  rescore_queued_at
) ON public.candidate_matches TO authenticated;

-- Deliberately NOT granted to `authenticated` (privileged server client only):
--   recommendation_reason      internal evaluation prose about the candidate
--   contact_release_reason     internal justification for releasing contacts
--   processing_error_code      internal pipeline diagnostics
--   processing_error_message   internal pipeline diagnostics
--   last_processing_trace_id   internal trace correlation id

-- service_role keeps full access for staff tooling and background jobs.
GRANT ALL ON public.candidate_matches TO service_role;
GRANT ALL ON public.rubric_templates TO service_role;

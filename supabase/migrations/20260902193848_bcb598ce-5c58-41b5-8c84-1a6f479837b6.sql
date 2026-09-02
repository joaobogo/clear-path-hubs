-- Candidate match privileges, narrowed to what a client actually needs.
--
-- Two defects, both in table-level GRANTs rather than in RLS. RLS decides WHICH
-- ROWS a role may touch; it has nothing to say about WHICH COLUMNS. That is what
-- column grants are for, and on this table they were either never applied or
-- were reverted.
--
-- 1. WRITES (audit 1 Sep, F43)
--    20260722131026 granted `SELECT, INSERT, UPDATE, DELETE` on candidate_matches
--    to `authenticated` and nothing ever narrowed it. So cm_client_editor_update
--    decided which rows a client editor could write, and the client could then
--    write ANY COLUMN on those rows.
--
--    Its WITH CHECK also omitted canonical_state, which its USING requires: the
--    OLD row had to be 'published_to_client', the NEW row was unconstrained. A
--    client holding `add_feedback` could therefore set canonical_state to any
--    value and move a match through states that represent admin review, and
--    could equally write the score columns or is_test_record.
--
--    The only BEFORE UPDATE trigger, candidate_matches_stage_guard, is declared
--    `BEFORE UPDATE OF stage` and validates stage transitions only. It never saw
--    these writes.
--
--    Every user-scoped writer in the application writes `stage` and nothing
--    else — client-decisions.functions.ts (3 call sites), hires.functions.ts,
--    interview-feedback.functions.ts. Staff paths go through the service_role
--    client, which is unaffected by grants to `authenticated`.
--
--    INSERT and DELETE are revoked too. No user-scoped path performs either, and
--    no permissive policy admits them for a non-staff caller, so RLS already
--    refused them — this removes the standing grant behind that.
--
-- 2. READS (audit 1 Sep, F44)
--    20260810170529 deliberately withheld five internal columns by replacing the
--    table-level SELECT with an explicit column list. Seven days later
--    20260817181351 ran `GRANT SELECT ON public.candidate_matches TO
--    authenticated` — a table-level grant, which silently restored read access
--    to all five. Nothing failed, so nothing surfaced it. The column list is
--    re-applied here.
--
--    intro_video_url / intro_video_added_at / intro_video_added_by were added
--    after 20260810170529 and so are absent from its list. Re-applying that list
--    verbatim would have revoked columns that work today, so they are included.

BEGIN;

-- ---------------------------------------------------------------- writes ----
REVOKE UPDATE, INSERT, DELETE ON public.candidate_matches FROM authenticated;
GRANT UPDATE (stage) ON public.candidate_matches TO authenticated;

-- canonical_state added to WITH CHECK so the policy states the invariant itself,
-- rather than relying on the grant above to be the only thing holding it.
DROP POLICY IF EXISTS cm_client_editor_update ON public.candidate_matches;
CREATE POLICY cm_client_editor_update ON public.candidate_matches
  FOR UPDATE TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND client_visibility = 'visible'
    AND canonical_state = 'published_to_client'
    AND public.has_client_permission(auth.uid(), organization_id, 'add_feedback')
  )
  WITH CHECK (
    client_visibility = 'visible'
    AND canonical_state = 'published_to_client'
    AND public.has_client_permission(auth.uid(), organization_id, 'add_feedback')
  );

-- ----------------------------------------------------------------- reads ----
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
  rescore_queued_at,
  intro_video_url,
  intro_video_added_at,
  intro_video_added_by
) ON public.candidate_matches TO authenticated;

-- Still withheld from `authenticated` (privileged server client only):
--   recommendation_reason      internal evaluation prose about the candidate
--   contact_release_reason     internal justification for releasing contacts
--   processing_error_code      internal pipeline diagnostics
--   processing_error_message   internal pipeline diagnostics
--   last_processing_trace_id   internal trace correlation id

-- service_role keeps full access for staff tooling and background jobs.
GRANT ALL ON public.candidate_matches TO service_role;

COMMIT;
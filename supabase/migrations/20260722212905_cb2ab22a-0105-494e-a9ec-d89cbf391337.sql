
-- =========================================================================
-- PHASE 4: DESTINATION READINESS — migration control + mapping + provenance
-- Idempotent. No data. No RLS weakening.
-- =========================================================================

-- ---------- 1. ENUMS ----------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.migration_run_status AS ENUM
    ('planned','running','completed','failed','aborted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.migration_row_status AS ENUM
    ('pending','imported','verified','superseded','rejected','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.migration_validation_status AS ENUM
    ('not_run','passed','warned','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- 2. CONTROL TABLES ------------------------------------------
CREATE TABLE IF NOT EXISTS public.migration_runs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_key            text NOT NULL UNIQUE,           -- e.g. 'MIG-2026-07-22-001'
  migration_version  text NOT NULL,                  -- e.g. 'v1.0.0'
  source_system      text NOT NULL DEFAULT 'taasflow-legacy',
  source_project_ref text,
  status             public.migration_run_status NOT NULL DEFAULT 'planned',
  dry_run            boolean NOT NULL DEFAULT true,
  started_at         timestamptz,
  finished_at        timestamptz,
  planned_count      bigint NOT NULL DEFAULT 0,
  imported_count     bigint NOT NULL DEFAULT 0,
  rejected_count     bigint NOT NULL DEFAULT 0,
  skipped_count      bigint NOT NULL DEFAULT 0,
  notes              text,
  created_by         uuid,                            -- operator profile.id (nullable, system runs)
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.migration_entity_results (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_run_id   uuid NOT NULL REFERENCES public.migration_runs(id) ON DELETE CASCADE,
  entity             text NOT NULL,                   -- 'positions','candidates',...
  source_table       text NOT NULL,
  destination_table  text NOT NULL,
  planned_count      bigint NOT NULL DEFAULT 0,
  imported_count     bigint NOT NULL DEFAULT 0,
  verified_count     bigint NOT NULL DEFAULT 0,
  rejected_count     bigint NOT NULL DEFAULT 0,
  skipped_count      bigint NOT NULL DEFAULT 0,
  duration_ms        bigint,
  validation_status  public.migration_validation_status NOT NULL DEFAULT 'not_run',
  started_at         timestamptz,
  finished_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (migration_run_id, entity)
);

CREATE TABLE IF NOT EXISTS public.migration_rejections (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_run_id   uuid NOT NULL REFERENCES public.migration_runs(id) ON DELETE CASCADE,
  entity             text NOT NULL,
  source_system      text NOT NULL DEFAULT 'taasflow-legacy',
  source_table       text NOT NULL,
  source_id          text NOT NULL,
  destination_table  text,
  error_code         text NOT NULL,                   -- e.g. 'ORPHAN_POSITION','DUPLICATE_EMAIL'
  error_detail       text,
  payload            jsonb,                           -- redacted snapshot of source row
  checksum           text,                            -- sha256 of payload
  resolved           boolean NOT NULL DEFAULT false,
  resolved_at        timestamptz,
  resolution_note    text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ---------- 3. GENERIC MAPPING TABLE TEMPLATE --------------------------
-- Every mapping table has the identical shape enforced by DDL below.
-- Uniqueness: one source row -> one destination row.

CREATE OR REPLACE FUNCTION public._mig_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'legacy_identity_map',
    'legacy_organization_map',
    'legacy_position_map',
    'legacy_candidate_map',
    'legacy_application_map',
    'legacy_submission_map',
    'legacy_file_map',
    'legacy_score_map'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS public.%I (
        id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        migration_run_id   uuid NOT NULL REFERENCES public.migration_runs(id) ON DELETE CASCADE,
        source_system      text NOT NULL DEFAULT 'taasflow-legacy',
        source_table       text NOT NULL,
        source_id          text NOT NULL,
        destination_table  text NOT NULL,
        destination_id     uuid,
        migration_status   public.migration_row_status NOT NULL DEFAULT 'pending',
        validation_status  public.migration_validation_status NOT NULL DEFAULT 'not_run',
        matched_by         text,
        migrated_at        timestamptz,
        error_code         text,
        error_detail       text,
        checksum           text,
        payload            jsonb,
        created_at         timestamptz NOT NULL DEFAULT now(),
        updated_at         timestamptz NOT NULL DEFAULT now()
      )
    $f$, t);

    -- one source row -> one destination row (idempotency)
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (source_system, source_table, source_id)',
      t || '_src_uq', t);

    -- destination cannot be claimed twice by different source rows
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (destination_table, destination_id) WHERE destination_id IS NOT NULL',
      t || '_dst_uq', t);

    -- fast lookups by run and by destination id
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (migration_run_id)',
      t || '_run_ix', t);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (destination_id)',
      t || '_did_ix', t);

    -- touch trigger
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_' || t || '_touch', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public._mig_touch_updated_at()',
      'trg_' || t || '_touch', t);
  END LOOP;
END $$;

-- ---------- 4. EXTRA IDENTITY UNIQUENESS (per spec) --------------------
-- Application identity: one legacy application id -> one destination application row
-- (already covered by legacy_application_map src_uq + dst_uq).

-- Role-specific submission identity: never two mappings pointing at the same
-- (position, candidate) destination pair via different source rows.
-- We enforce this in destination via existing candidate_matches unique key when present.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public'
      AND indexname='candidate_matches_position_candidate_uq'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX candidate_matches_position_candidate_uq
             ON public.candidate_matches (position_id, candidate_profile_id)';
  END IF;
EXCEPTION WHEN unique_violation THEN
  -- duplicates exist in destination; leave index absent and log via linter
  RAISE NOTICE 'candidate_matches (position_id, candidate_profile_id) has duplicates; unique index skipped';
END $$;

-- Scoring-run identity: legacy score_map already enforces one legacy run -> one dest run.
-- Cross-position reuse is enforced by tg_score_runs_identity trigger (existing).

-- Storage file migration identity: one legacy files.id -> one dest files.id (in map),
-- plus content dedupe via sha256 on files table if column exists.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='files' AND column_name='sha256') THEN
    CREATE INDEX IF NOT EXISTS files_sha256_ix ON public.files (sha256);
  END IF;
END $$;

-- ---------- 5. PROVENANCE COLUMNS ON DESTINATION TABLES ----------------
DO $$
DECLARE
  t text;
  targets text[] := ARRAY[
    'profiles','organizations','memberships','positions','screening_questions',
    'candidate_profiles','applications','application_answers','candidate_matches',
    'files','candidate_evidence','score_runs','client_decisions','interviews',
    'messages','notifications','audit_events','intake_submissions','consent_records'
  ];
BEGIN
  FOREACH t IN ARRAY targets LOOP
    -- only add columns if the table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I
        ADD COLUMN IF NOT EXISTS legacy_source_system text,
        ADD COLUMN IF NOT EXISTS legacy_source_table  text,
        ADD COLUMN IF NOT EXISTS legacy_source_id     text,
        ADD COLUMN IF NOT EXISTS migrated_at          timestamptz,
        ADD COLUMN IF NOT EXISTS migration_run_id     uuid,
        ADD COLUMN IF NOT EXISTS migration_version    text,
        ADD COLUMN IF NOT EXISTS migration_status     public.migration_row_status', t);

      -- one legacy row -> one destination row per table (idempotency guard)
      EXECUTE format(
        'CREATE UNIQUE INDEX IF NOT EXISTS %I
         ON public.%I (legacy_source_table, legacy_source_id)
         WHERE legacy_source_id IS NOT NULL',
        t || '_legacy_src_uq', t);

      -- helpful provenance lookup
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (migration_run_id)
         WHERE migration_run_id IS NOT NULL',
        t || '_mig_run_ix', t);
    END IF;
  END LOOP;
END $$;

-- ---------- 6. LOOKUP INDEXES (spec) -----------------------------------
CREATE INDEX IF NOT EXISTS memberships_user_org_ix
  ON public.memberships (user_id, organization_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS memberships_org_role_ix
  ON public.memberships (organization_id, role) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS candidate_profiles_email_ix
  ON public.candidate_profiles (lower(email));
CREATE INDEX IF NOT EXISTS candidate_profiles_user_ix
  ON public.candidate_profiles (user_id);

CREATE INDEX IF NOT EXISTS positions_org_status_ix
  ON public.positions (organization_id, status);
CREATE INDEX IF NOT EXISTS positions_published_ix
  ON public.positions (published_at) WHERE published_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS applications_position_ix
  ON public.applications (position_id);
CREATE INDEX IF NOT EXISTS applications_candidate_ix
  ON public.applications (candidate_profile_id);

CREATE INDEX IF NOT EXISTS candidate_matches_org_ix
  ON public.candidate_matches (organization_id);
CREATE INDEX IF NOT EXISTS candidate_matches_position_ix
  ON public.candidate_matches (position_id);
CREATE INDEX IF NOT EXISTS candidate_matches_candidate_ix
  ON public.candidate_matches (candidate_profile_id);

CREATE INDEX IF NOT EXISTS score_runs_match_ix
  ON public.score_runs (candidate_match_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS score_runs_position_ix
  ON public.score_runs (position_id);

-- ---------- 7. GRANTS + RLS (service-role only for migration surface) --
DO $$
DECLARE
  t text;
  tabs text[] := ARRAY[
    'migration_runs','migration_entity_results','migration_rejections',
    'legacy_identity_map','legacy_organization_map','legacy_position_map',
    'legacy_candidate_map','legacy_application_map','legacy_submission_map',
    'legacy_file_map','legacy_score_map'
  ];
BEGIN
  FOREACH t IN ARRAY tabs LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    -- explicit deny for authenticated + anon; service_role bypasses RLS by default
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'deny_all_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      'deny_all_' || t, t);
  END LOOP;
END $$;

-- ---------- 8. Touch trigger for control tables ------------------------
DROP TRIGGER IF EXISTS trg_migration_runs_touch ON public.migration_runs;
CREATE TRIGGER trg_migration_runs_touch BEFORE UPDATE ON public.migration_runs
  FOR EACH ROW EXECUTE FUNCTION public._mig_touch_updated_at();

DROP TRIGGER IF EXISTS trg_migration_entity_results_touch ON public.migration_entity_results;
CREATE TRIGGER trg_migration_entity_results_touch BEFORE UPDATE ON public.migration_entity_results
  FOR EACH ROW EXECUTE FUNCTION public._mig_touch_updated_at();

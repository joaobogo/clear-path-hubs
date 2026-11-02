-- Screening questions for applications that skipped the apply form (2 Nov 2026).
--
-- A CV sent to the team by email and entered by staff (source_channel
-- 'direct_email'), an admin assignment or an import never showed the candidate
-- the role's screening questions. The candidate can now answer them on the
-- status page, and the pipeline drain emails the link once. These columns are
-- the once-only marker and the outcome:
--   screening_invite_status      NULL = not decided yet; then sending | sent |
--                                suppressed | failed | not_needed, or
--                                predates_feature (below)
--   screening_invite_sent_at     when the last invitation was delivered
--   screening_invite_error_code  why it was suppressed, failed or not needed
--
-- No retroactive sends. The status column is added with the constant default
-- 'predates_feature' and the default is dropped straight after: every row that
-- exists when this runs reads 'predates_feature' (Postgres keeps the value in
-- the catalog: no table rewrite and no UPDATE, so updated_at and the audit
-- trigger are untouched), while every row inserted afterwards starts NULL. The
-- sweep only reads NULL rows, so nothing created before this migration is ever
-- emailed automatically; staff can still send from the candidate page.
-- Rollback: ALTER TABLE public.applications DROP COLUMN screening_invite_status,
--   DROP COLUMN screening_invite_sent_at, DROP COLUMN screening_invite_error_code;
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS screening_invite_status text DEFAULT 'predates_feature';
ALTER TABLE public.applications
  ALTER COLUMN screening_invite_status DROP DEFAULT;
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS screening_invite_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS screening_invite_error_code text;

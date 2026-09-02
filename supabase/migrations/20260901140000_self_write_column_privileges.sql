-- Self-service writes, narrowed to the columns each surface actually edits.
--
-- Three tables let a non-staff caller UPDATE their own row under a policy that
-- checks WHICH ROW and never WHICH COLUMNS, over a table-wide GRANT UPDATE to
-- `authenticated`. Same shape as F43 on candidate_matches.
--
-- F45 — profiles: a suspended user could reactivate themselves.
--   profiles_self is `FOR ALL TO authenticated USING (auth_user_id = auth.uid())`.
--   public.is_active_user(_user) is defined as
--       EXISTS (SELECT 1 FROM public.profiles
--                WHERE auth_user_id = _user AND status = 'active')
--   and gates a large share of the policy surface. So a user whose access had
--   been withdrawn could PATCH their own profiles.status back to 'active' and
--   restore it. The profile_status_reassignment trigger does not prevent this:
--   it is AFTER UPDATE OF status and REACTS to the change — on a self-service
--   reactivation it would helpfully clear the reassignment flags.
--
--   profiles.email is withheld for a second reason. The public application
--   handler resolves an auth account by `profiles.email` when linking an
--   unclaimed candidate profile. A user who could set their own profiles.email
--   to somebody else's address could have an unclaimed candidate profile for
--   that address linked to their own auth user.
--
-- F46 — organizations: a client admin could grant themselves commercial terms.
--   organizations_admin_update is scoped by is_org_admin and nothing else, so a
--   workspace admin could write client_seat_limit, plan_name, the billing_*
--   window, renewal_date, the pilot_* lifecycle (extending their own pilot
--   indefinitely), the is_demo / is_internal / is_qa / is_test_record flags that
--   decide what appears in reporting, internal_notes, status, archived_at, and
--   parent_organization_id.
--
-- F47 — candidate_profiles: cp_self is FOR ALL on the candidate's own row.
--   The WITH CHECK pins user_id = auth.uid(), so a profile cannot be reassigned
--   to another account, and the self-service editor is a legitimate surface.
--   The grant is narrowed to what that editor writes; email is withheld for the
--   same linking reason as profiles.email above.
--
-- Every column granted below was taken from a user-scoped writer found in the
-- application, not from judgement about what "looks safe":
--
--   profiles              client-context.functions.ts (onboarding dismissal)
--                         client-settings.functions.ts (timezone)
--   organizations         client-settings.functions.ts (company profile)
--                         client-context.functions.ts (branding)
--                         onboarding.functions.ts (company profile, status)
--   candidate_profiles    candidate.functions.ts (profile editor, CV, consent)
--                         candidate/notification-prefs.functions.ts (consent)
--
-- Writers on the privileged server client are unaffected: service_role bypasses
-- column grants.

BEGIN;

-- ------------------------------------------------------------- profiles ----
REVOKE UPDATE, INSERT, DELETE ON public.profiles FROM authenticated;
GRANT UPDATE (
  timezone,
  client_onboarding_dismissed_at
) ON public.profiles TO authenticated;

-- Withheld from `authenticated` (privileged server client only):
--   status                     gates public.is_active_user — see F45 above
--   email                      account-linking key in the public apply handler
--   auth_user_id               the row's own identity
--   full_name, phone, locale   written through auth.functions on the server client
--   show_test_records          written through test-scope.functions on the server client
--   is_test_record, expires_at, test_run_id, created_by_audit,
--   legacy_*, migration_*      provenance and lifecycle, never self-service

-- -------------------------------------------------------- organizations ----
REVOKE UPDATE, INSERT, DELETE ON public.organizations FROM authenticated;
GRANT UPDATE (
  name,
  website,
  industry,
  headquarters,
  phone,
  logo_url,
  brand_display_name,
  brand_primary_color,
  brand_accent_color,
  onboarding_status
) ON public.organizations TO authenticated;

-- Withheld from `authenticated` (privileged server client only):
--   plan_name, client_seat_limit                    entitlements
--   billing_interval, billing_period_start,
--   billing_period_end, renewal_date                billing window
--   pilot_status, pilot_started_at, pilot_ends_at,
--   pilot_used, pilot_completed_at, pilot_position_id,
--   pilot_admin_override, pilot_override_at,
--   pilot_override_by, pilot_override_reason        pilot lifecycle
--   is_demo, is_internal, is_qa, is_test_record     reporting scope flags
--   internal_notes                                  internal staff prose
--   status, archived_at                             account lifecycle
--   parent_organization_id                          org hierarchy
--   domain, name_normalized                         matching keys
--   dashboard_status, locations,
--   primary_contact_name, primary_contact_email,
--   last_client_update_sent_at                      staff-managed
--   expires_at, test_run_id, created_by_audit,
--   legacy_*, migration_*                           provenance and lifecycle

-- --------------------------------------------------- candidate_profiles ----
REVOKE UPDATE, INSERT, DELETE ON public.candidate_profiles FROM authenticated;
GRANT UPDATE (
  full_name,
  headline,
  summary,
  phone,
  location,
  timezone,
  availability,
  skills,
  languages,
  certifications,
  education,
  experience,
  years_experience,
  work_authorization,
  compensation_preferences,
  linkedin_url,
  portfolio_url,
  current_cv_file_id,
  consent
) ON public.candidate_profiles TO authenticated;

-- Withheld from `authenticated` (privileged server client only):
--   email                      account-linking key in the public apply handler
--   user_id                    already pinned by cp_self's WITH CHECK; not writable
--   website_url, region,
--   city, country              written by the public apply handler on the server client
--   gap_nudge_count,
--   gap_nudge_last_at          internal nudge accounting
--   is_test_record, expires_at, test_run_id, created_by_audit,
--   legacy_*, migration_*      provenance and lifecycle

-- service_role keeps full access for staff tooling and background jobs.
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.organizations TO service_role;
GRANT ALL ON public.candidate_profiles TO service_role;

COMMIT;

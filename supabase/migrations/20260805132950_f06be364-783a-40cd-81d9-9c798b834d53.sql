ALTER TABLE public.client_notification_preferences
  ADD COLUMN IF NOT EXISTS pref_shortlist_delivered text NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS pref_decision_overdue text NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS pref_interview_update text NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS pref_offer_response text NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS pref_information_needed text NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS pref_weekly_summary text NOT NULL DEFAULT 'immediate';

-- Carry over the legacy boolean/global-cadence model so nobody's choice is lost.
UPDATE public.client_notification_preferences
SET
  pref_shortlist_delivered = CASE
    WHEN candidate_delivered = false OR email_enabled = false OR digest = 'off' THEN 'off'
    WHEN digest IN ('daily','weekly') THEN 'daily' ELSE 'immediate' END,
  pref_interview_update = CASE
    WHEN interview_request = false OR email_enabled = false OR digest = 'off' THEN 'off'
    WHEN digest IN ('daily','weekly') THEN 'daily' ELSE 'immediate' END,
  pref_offer_response = CASE
    WHEN offer_update = false OR email_enabled = false OR digest = 'off' THEN 'off'
    WHEN digest IN ('daily','weekly') THEN 'daily' ELSE 'immediate' END,
  -- Service notices can be deferred but never switched off.
  pref_decision_overdue = CASE
    WHEN email_enabled = false OR digest IN ('off','daily','weekly') THEN 'daily' ELSE 'immediate' END,
  pref_information_needed = CASE
    WHEN email_enabled = false OR digest IN ('off','daily','weekly') THEN 'daily' ELSE 'immediate' END,
  pref_weekly_summary = CASE
    WHEN email_enabled = false OR digest = 'off' THEN 'off' ELSE 'immediate' END;

ALTER TABLE public.client_notification_preferences
  DROP CONSTRAINT IF EXISTS cnp_pref_shortlist_delivered_check,
  DROP CONSTRAINT IF EXISTS cnp_pref_decision_overdue_check,
  DROP CONSTRAINT IF EXISTS cnp_pref_interview_update_check,
  DROP CONSTRAINT IF EXISTS cnp_pref_offer_response_check,
  DROP CONSTRAINT IF EXISTS cnp_pref_information_needed_check,
  DROP CONSTRAINT IF EXISTS cnp_pref_weekly_summary_check;

ALTER TABLE public.client_notification_preferences
  ADD CONSTRAINT cnp_pref_shortlist_delivered_check CHECK (pref_shortlist_delivered IN ('immediate','daily','off')),
  ADD CONSTRAINT cnp_pref_interview_update_check CHECK (pref_interview_update IN ('immediate','daily','off')),
  ADD CONSTRAINT cnp_pref_offer_response_check CHECK (pref_offer_response IN ('immediate','daily','off')),
  ADD CONSTRAINT cnp_pref_decision_overdue_check CHECK (pref_decision_overdue IN ('immediate','daily')),
  ADD CONSTRAINT cnp_pref_information_needed_check CHECK (pref_information_needed IN ('immediate','daily')),
  ADD CONSTRAINT cnp_pref_weekly_summary_check CHECK (pref_weekly_summary IN ('immediate','off'));

COMMENT ON COLUMN public.client_notification_preferences.pref_decision_overdue IS 'Service notice: immediate or daily digest only, never off.';
COMMENT ON COLUMN public.client_notification_preferences.pref_information_needed IS 'Service notice: immediate or daily digest only, never off.';

GRANT SELECT, INSERT, UPDATE ON public.client_notification_preferences TO authenticated;
GRANT ALL ON public.client_notification_preferences TO service_role;
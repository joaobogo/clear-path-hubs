
-- Source of Hire & Channel Attribution
DO $$ BEGIN
  CREATE TYPE public.source_kind AS ENUM ('inbound','sourced','referral','agency','rehire','event','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS source_kind public.source_kind,
  ADD COLUMN IF NOT EXISTS source_channel text,
  ADD COLUMN IF NOT EXISTS source_campaign text,
  ADD COLUMN IF NOT EXISTS source_cost_cents integer,
  ADD COLUMN IF NOT EXISTS outreach_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS outreach_replied_at timestamptz;

CREATE INDEX IF NOT EXISTS applications_source_channel_ix
  ON public.applications (source_channel) WHERE source_channel IS NOT NULL;

-- Per-application attribution row (RLS inherited via security_invoker)
CREATE OR REPLACE VIEW public.v_source_attribution
WITH (security_invoker=on) AS
SELECT
  p.organization_id,
  COALESCE(NULLIF(a.source_channel,''), NULLIF(a.source,''), 'unknown') AS channel,
  COALESCE(
    a.source_kind::text,
    CASE WHEN a.outreach_sent_at IS NOT NULL THEN 'sourced' ELSE 'inbound' END
  ) AS kind,
  a.id AS application_id,
  a.candidate_profile_id,
  a.position_id,
  a.applied_at,
  a.outreach_sent_at,
  a.outreach_replied_at,
  a.source_cost_cents,
  a.source_campaign,
  cm.id AS match_id,
  cm.stage,
  hr.status AS hire_status,
  hr.hired_at
FROM public.applications a
JOIN public.positions p ON p.id = a.position_id
LEFT JOIN LATERAL (
  SELECT id, stage
  FROM public.candidate_matches m
  WHERE m.application_id = a.id
  ORDER BY m.created_at DESC
  LIMIT 1
) cm ON true
LEFT JOIN LATERAL (
  SELECT status, hired_at
  FROM public.hire_records h
  WHERE h.candidate_match_id = cm.id
  ORDER BY h.created_at DESC
  LIMIT 1
) hr ON true
WHERE COALESCE(a.is_test_record, false) = false;

-- Channel × kind rollup with funnel + cost proxy
CREATE OR REPLACE VIEW public.v_source_attribution_rollup
WITH (security_invoker=on) AS
SELECT
  organization_id,
  channel,
  kind,
  count(*) AS applications,
  count(*) FILTER (WHERE outreach_sent_at IS NOT NULL) AS outreach_sent,
  count(*) FILTER (WHERE outreach_replied_at IS NOT NULL) AS outreach_replied,
  count(*) FILTER (WHERE stage IN ('shortlisted','interview_process','offer','hired')) AS shortlisted,
  count(*) FILTER (WHERE stage IN ('interview_process','offer','hired')) AS interviewed,
  count(*) FILTER (WHERE stage IN ('offer','hired')) AS offered,
  count(*) FILTER (WHERE hire_status = 'hire_confirmed') AS hired,
  COALESCE(sum(source_cost_cents), 0) AS total_cost_cents,
  min(applied_at) AS first_applied_at,
  max(applied_at) AS last_applied_at
FROM public.v_source_attribution
GROUP BY organization_id, channel, kind;

GRANT SELECT ON public.v_source_attribution TO authenticated;
GRANT SELECT ON public.v_source_attribution_rollup TO authenticated;
GRANT ALL   ON public.v_source_attribution TO service_role;
GRANT ALL   ON public.v_source_attribution_rollup TO service_role;

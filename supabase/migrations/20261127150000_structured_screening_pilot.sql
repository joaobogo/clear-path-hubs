-- Structured screening pilot (spec v1, 27 Nov 2026).
--
-- Two jobs ask short, structured questions built from their must-haves
-- instead of their standard screening questions. Everything here is
-- additive: two new tables and two nullable columns on positions. Nothing
-- existing is renamed, dropped, retyped or rewritten, and the switch is off
-- for every job, including the two pilot jobs, until it is turned on.
--
-- The questions and answers live in tables of their own. The standard
-- screening_questions are saved by the role editor, which deletes questions
-- missing from its list (and their answers with them); keeping the pilot out
-- of that table means no editor save can touch it.

ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS structured_screening_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS structured_screening_enabled_at timestamptz;

-- A one-off secret that opens a hidden TEST copy of a job (is_test_record)
-- for testing the pilot form. Honoured only on test records; set while
-- testing and cleared afterwards.
ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS structured_screening_preview_token text;

COMMENT ON COLUMN public.positions.structured_screening_enabled IS
  'Structured screening pilot: when true the apply form asks structured_screening_questions instead of screening_questions. Off by default; turning it off restores the standard form and keeps every answer.';

CREATE TABLE IF NOT EXISTS public.structured_screening_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  type text NOT NULL CHECK (type IN ('yes_no','single_select','multi_select','short_text','url','number_range')),
  options jsonb,
  required boolean NOT NULL DEFAULT false,
  section text NOT NULL CHECK (section IN ('about_you','this_role')),
  maps_to_requirement text,
  pass_rule jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  help text,
  unit text,
  show_when jsonb,
  short_label text,
  staff_only boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (position_id, key)
);

CREATE TABLE IF NOT EXISTS public.structured_screening_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  question_key text NOT NULL,
  value jsonb,
  source text NOT NULL DEFAULT 'candidate' CHECK (source IN ('candidate','cv_linkedin','recruiter')),
  status text NOT NULL DEFAULT 'answered' CHECK (status IN ('answered','not_asked','skipped')),
  source_note text,
  entered_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, question_key)
);

CREATE INDEX IF NOT EXISTS structured_screening_answers_position_idx
  ON public.structured_screening_answers (position_id);

-- Reads and writes go through the server. Staff may read; nobody else reads
-- these directly (pay expectation is staff only).
ALTER TABLE public.structured_screening_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structured_screening_answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.structured_screening_questions FROM anon, authenticated;
REVOKE ALL ON public.structured_screening_answers FROM anon, authenticated;
GRANT SELECT ON public.structured_screening_questions TO authenticated;
GRANT SELECT ON public.structured_screening_answers TO authenticated;
GRANT ALL ON public.structured_screening_questions TO service_role;
GRANT ALL ON public.structured_screening_answers TO service_role;

DROP POLICY IF EXISTS "staff read structured questions" ON public.structured_screening_questions;
CREATE POLICY "staff read structured questions" ON public.structured_screening_questions
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));
DROP POLICY IF EXISTS "staff read structured answers" ON public.structured_screening_answers;
CREATE POLICY "staff read structured answers" ON public.structured_screening_answers
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));

-- The pilot questions, for the two pilot jobs only. Inserting them changes
-- nothing anyone sees: the form shows them only once the switch is on.
INSERT INTO public.structured_screening_questions
  (position_id, key, label, type, options, required, section, maps_to_requirement, pass_rule, sort_order, help, unit, show_when, short_label, staff_only)
VALUES
  -- Enterprise Sales Director – UK & Ireland
  ('a781288f-cf6f-45d6-b78f-5db5a846bc15','linkedin_url','LinkedIn profile URL','url',NULL,true,'about_you',NULL,NULL,10,NULL,NULL,NULL,'LinkedIn',false),
  ('a781288f-cf6f-45d6-b78f-5db5a846bc15','based_in','Where are you based? (city, country)','short_text',NULL,true,'about_you',NULL,NULL,20,NULL,NULL,NULL,'Based in',false),
  ('a781288f-cf6f-45d6-b78f-5db5a846bc15','work_auth','Do you already have the right to work in the UK?','yes_no',NULL,true,'about_you',NULL,'{"equals": true}',30,NULL,NULL,NULL,'Right to work in the UK',false),
  ('a781288f-cf6f-45d6-b78f-5db5a846bc15','start','When could you start?','single_select','["Immediately","1 month","2-3 months","3+ months"]',false,'about_you',NULL,NULL,40,NULL,NULL,NULL,'Start',false),
  ('a781288f-cf6f-45d6-b78f-5db5a846bc15','pay_expectation','Expected base salary (GBP per year)','number_range',NULL,false,'about_you',NULL,NULL,50,'A range is fine.','GBP per year',NULL,'Pay expectation',true),
  ('a781288f-cf6f-45d6-b78f-5db5a846bc15','largest_deal','Largest deal you personally closed (total contract value)','single_select','["Under $500k","$500k-1M","$1-2M","$2-5M","$5M+"]',true,'this_role','Has personally closed enterprise deals of $2M+ in total contract value','{"in": ["$2-5M","$5M+"], "verify_with_cv": true}',10,NULL,NULL,NULL,'Largest deal',false),
  ('a781288f-cf6f-45d6-b78f-5db5a846bc15','largest_deal_what','What was that deal? (one line)','short_text',NULL,true,'this_role',NULL,NULL,20,'For example: data migration for a UK retail bank.',NULL,NULL,'Deal',false),
  ('a781288f-cf6f-45d6-b78f-5db5a846bc15','bookings_target','In the last 3 years, did you meet or beat a multi-million new-business bookings target?','yes_no',NULL,true,'this_role','Consistently met or exceeded multi-million new-business bookings targets','{"equals": true, "verify_with_cv": true}',30,NULL,NULL,NULL,'Bookings target met',false),
  ('a781288f-cf6f-45d6-b78f-5db5a846bc15','platforms_sold','Which cloud data platforms have you sold around?','multi_select','["Snowflake","Databricks","BigQuery","Microsoft (Azure, Fabric)","None"]',true,'this_role','Deep knowledge of the cloud data ecosystem: Snowflake, Databricks, BigQuery and Microsoft','{"min_count": 2, "exclude": ["None"], "verify_with_cv": true}',40,'Pick all that apply.',NULL,NULL,'Platforms',false),
  ('a781288f-cf6f-45d6-b78f-5db5a846bc15','uk_buyer_network','How many senior data or tech buyers (CIO, CDO, Head of Data) in UK enterprises could you call this month?','single_select','["0","1-5","6-15","15+"]',true,'this_role','Established network of senior data/technology buyers (CIO, CDO, Head of Data) in UK enterprises','{"in": ["6-15","15+"]}',50,NULL,NULL,NULL,'UK buyer network',false),
  ('a781288f-cf6f-45d6-b78f-5db5a846bc15','london_travel','Are you based in or commutable to London, and able to travel up to 50%?','yes_no',NULL,true,'this_role','Based in or commutable to London, and able to travel up to 50%','{"equals": true}',60,NULL,NULL,NULL,'London and travel',false),
  -- Enterprise Sales Director – Netherlands
  ('f069e33b-3f83-4724-8be6-745d019de01e','linkedin_url','LinkedIn profile URL','url',NULL,true,'about_you',NULL,NULL,10,NULL,NULL,NULL,'LinkedIn',false),
  ('f069e33b-3f83-4724-8be6-745d019de01e','based_in','Where are you based? (city, country)','short_text',NULL,true,'about_you',NULL,NULL,20,NULL,NULL,NULL,'Based in',false),
  ('f069e33b-3f83-4724-8be6-745d019de01e','work_auth','Can you work in the Netherlands?','yes_no',NULL,true,'about_you',NULL,'{"equals": true}',30,NULL,NULL,NULL,'Can work in the Netherlands',false),
  ('f069e33b-3f83-4724-8be6-745d019de01e','start','When could you start?','single_select','["Immediately","1 month","2-3 months","3+ months"]',false,'about_you',NULL,NULL,40,NULL,NULL,NULL,'Start',false),
  ('f069e33b-3f83-4724-8be6-745d019de01e','pay_expectation','Expected monthly retainer (EUR per month)','number_range',NULL,false,'about_you',NULL,NULL,50,'A range is fine.','EUR per month',NULL,'Pay expectation',true),
  ('f069e33b-3f83-4724-8be6-745d019de01e','dutch_level','Your level of Dutch','single_select','["Basic","Conversational","Professional","Native"]',true,'this_role','Fluent in Dutch and English at a professional level','{"in": ["Professional","Native"]}',10,NULL,NULL,NULL,'Dutch',false),
  ('f069e33b-3f83-4724-8be6-745d019de01e','english_level','Your level of English','single_select','["Basic","Conversational","Professional","Native"]',true,'this_role','Fluent in Dutch and English at a professional level','{"in": ["Professional","Native"]}',20,NULL,NULL,NULL,'English',false),
  ('f069e33b-3f83-4724-8be6-745d019de01e','largest_deal','Largest deal you personally closed (total contract value)','single_select','["Under $500k","$500k-1M","$1-2M","$2-5M","$5M+"]',true,'this_role','Has personally closed enterprise deals of $2M+ in total contract value','{"in": ["$2-5M","$5M+"], "verify_with_cv": true}',30,NULL,NULL,NULL,'Largest deal',false),
  ('f069e33b-3f83-4724-8be6-745d019de01e','largest_deal_what','What was that deal? (one line)','short_text',NULL,true,'this_role',NULL,NULL,40,'For example: data migration for a Dutch bank.',NULL,NULL,'Deal',false),
  ('f069e33b-3f83-4724-8be6-745d019de01e','fs_benelux','Have you sold to banks or insurers in the Netherlands or Benelux in the last 5 years?','yes_no',NULL,true,'this_role','Strong track record selling into Financial Services in the Netherlands or Benelux','{"equals": true, "verify_with_cv": true}',50,NULL,NULL,NULL,'Financial services in Benelux',false),
  ('f069e33b-3f83-4724-8be6-745d019de01e','fs_benelux_names','If yes, name up to 2.','short_text',NULL,false,'this_role',NULL,NULL,55,'Optional.',NULL,'{"key": "fs_benelux", "equals": true}','Clients',false),
  ('f069e33b-3f83-4724-8be6-745d019de01e','kvk','Do you invoice through your own KvK-registered business?','single_select','["Yes","No, but willing","No"]',true,'this_role','Works, or will work, as an independent consultant through own KvK-registered business','{"in": ["Yes","No, but willing"]}',60,NULL,NULL,NULL,'KvK',false),
  ('f069e33b-3f83-4724-8be6-745d019de01e','amsterdam_travel','Are you based in or near Amsterdam, and able to travel up to 50%?','yes_no',NULL,true,'this_role','Based in or near Amsterdam, and able to travel up to 50% in the Netherlands and Europe','{"equals": true}',70,NULL,NULL,NULL,'Amsterdam and travel',false)
ON CONFLICT (position_id, key) DO NOTHING;

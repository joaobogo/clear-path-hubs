-- Screening questions currently grant ALL privileges on the whole table to
-- anon and authenticated, so column-level grants were ineffective and any
-- signed-in candidate could read preferred_answer / dealbreaker / must_have /
-- scoring_weight for a public role before applying.
--
-- Sensitive columns are only ever read by service_role (admin/processing code),
-- so public roles are reduced to SELECT on the candidate-visible columns only.

REVOKE ALL ON public.screening_questions FROM anon;
REVOKE ALL ON public.screening_questions FROM authenticated;

GRANT SELECT (
  id,
  position_id,
  question,
  why_asked,
  answer_type,
  required,
  options,
  display_order,
  created_at,
  updated_at
) ON public.screening_questions TO anon;

GRANT SELECT (
  id,
  position_id,
  question,
  why_asked,
  answer_type,
  required,
  options,
  display_order,
  created_at,
  updated_at
) ON public.screening_questions TO authenticated;

GRANT ALL ON public.screening_questions TO service_role;

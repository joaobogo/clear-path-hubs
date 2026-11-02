-- One-off backfill, part B of 2: APPLY. This file WRITES when run.
-- Run 0001a_profile_certifications_dry_run.sql first and review its output;
-- this file repeats exactly the same rules (see the header of 0001a) and
-- writes what 0001a listed. NOT a migration.
--
-- Each write also records consent.backfilled.<field> = {at, cv_file_id,
-- source} in the same UPDATE, as the pipeline does, so the field is not
-- filled again from the same CV if a person clears it afterwards.
--
-- Rollback: every row returned below had an empty value before. For those
-- ids: SET certifications = '[]'::jsonb, consent = consent #- '{backfilled,certifications}'
-- (or years_experience = NULL, consent = consent #- '{backfilled,years_experience}').
--
-- Idempotent: a second run finds nothing to change. No trigger on
-- candidate_profiles invalidates scores for these columns (only a new CV
-- does), and the scorer reads CV text, not these columns: no score moves.

BEGIN;

WITH candidates AS (
  SELECT cp.id, cp.consent -> 'extracted' -> 'certifications' AS parsed
  FROM public.candidate_profiles cp
  WHERE (cp.certifications IS NULL OR cp.certifications = '[]'::jsonb)
    AND jsonb_typeof(cp.consent -> 'extracted' -> 'certifications') = 'array'
    AND NOT coalesce(cp.consent -> 'locked_fields' @> '["certifications"]'::jsonb, false)
    AND coalesce(cp.consent -> 'provenance' -> 'certifications' ->> 'source', '')
        NOT IN ('admin_corrected', 'user_confirmed')
    AND NOT (jsonb_typeof(cp.consent -> 'provenance' -> 'certifications' -> 'confidence') = 'number'
             AND (cp.consent -> 'provenance' -> 'certifications' ->> 'confidence')::numeric < 0.8)
    AND NOT (coalesce(jsonb_typeof(cp.consent -> 'backfilled' -> 'certifications'), 'null') <> 'null'
             AND (cp.consent -> 'backfilled' -> 'certifications' ->> 'cv_file_id')
                 IS NOT DISTINCT FROM cp.current_cv_file_id::text)
),
items AS (
  SELECT c.id, e.ord,
    left(btrim(regexp_replace(CASE jsonb_typeof(e.v)
      WHEN 'string' THEN e.v #>> '{}'
      WHEN 'object' THEN coalesce(e.v ->> 'name', e.v ->> 'title', e.v ->> 'certification')
    END, '\s+', ' ', 'g')), 200) AS name,
    CASE WHEN jsonb_typeof(e.v) = 'object' THEN nullif(left(btrim(regexp_replace(
      coalesce(e.v ->> 'issuer', e.v ->> 'organization', e.v ->> 'authority', e.v ->> 'issued_by'),
      '\s+', ' ', 'g')), 200), '') END AS issuer,
    CASE WHEN jsonb_typeof(e.v) = 'object' THEN nullif(left(btrim(regexp_replace(
      coalesce(e.v ->> 'date', e.v ->> 'issued', e.v ->> 'year'),
      '\s+', ' ', 'g')), 40), '') END AS date
  FROM candidates c
  CROSS JOIN LATERAL jsonb_array_elements(c.parsed) WITH ORDINALITY AS e(v, ord)
),
deduped AS (
  SELECT DISTINCT ON (id, lower(name)) id, ord, name, issuer, date
  FROM items
  WHERE name IS NOT NULL
    AND length(name) >= 3
    AND NOT (name !~ '\s' AND length(name) <= 6 AND name !~ '[0-9]'
             AND length(regexp_replace(name, '[^A-Z]', '', 'g')) < 2)
    AND name !~* '\y(effies?|cannes lions|grand prix|shortlist(ed)?|finalists?|winners?|nominee|nominated|honou?rable mention)\y'
    AND NOT (name ~* '\yawards?\y' AND name ~* '\y(gold|silver|bronze)\y')
  ORDER BY id, lower(name), ord
),
proposed AS (
  SELECT id, jsonb_agg(jsonb_build_object('name', name, 'issuer', issuer, 'date', date) ORDER BY ord) AS certs
  FROM (SELECT d.*, row_number() OVER (PARTITION BY id ORDER BY ord) AS rn FROM deduped d) x
  WHERE rn <= 50
  GROUP BY id
)
UPDATE public.candidate_profiles cp
SET certifications = p.certs,
    consent = jsonb_set(
      cp.consent, '{backfilled}',
      CASE WHEN jsonb_typeof(cp.consent -> 'backfilled') = 'object'
           THEN cp.consent -> 'backfilled' ELSE '{}'::jsonb END
      || jsonb_build_object('certifications', jsonb_build_object(
           'at', now(), 'cv_file_id', cp.current_cv_file_id,
           'source', 'scripts/backfill/0001b')))
FROM proposed p
WHERE cp.id = p.id
  AND (cp.certifications IS NULL OR cp.certifications = '[]'::jsonb)
RETURNING cp.id, cp.full_name, jsonb_array_length(cp.certifications) AS certifications_written;

WITH parsed AS (
  SELECT cp.id, cp.consent -> 'extracted' -> 'years_of_experience' AS v
  FROM public.candidate_profiles cp
  WHERE cp.years_experience IS NULL
    AND NOT coalesce(cp.consent -> 'locked_fields' @> '["years_experience"]'::jsonb, false)
    AND NOT coalesce(cp.consent -> 'locked_fields' @> '["years_of_experience"]'::jsonb, false)
    AND coalesce(cp.consent -> 'provenance' -> 'years_experience' ->> 'source', '')
        NOT IN ('admin_corrected', 'user_confirmed')
    AND coalesce(cp.consent -> 'provenance' -> 'years_of_experience' ->> 'source', '')
        NOT IN ('admin_corrected', 'user_confirmed')
    AND NOT (coalesce(jsonb_typeof(cp.consent -> 'backfilled' -> 'years_experience'), 'null') <> 'null'
             AND (cp.consent -> 'backfilled' -> 'years_experience' ->> 'cv_file_id')
                 IS NOT DISTINCT FROM cp.current_cv_file_id::text)
),
proposed AS (
  SELECT id,
    floor(CASE
      WHEN jsonb_typeof(v) = 'number' THEN (v #>> '{}')::numeric
      WHEN jsonb_typeof(v) = 'string' AND btrim(v #>> '{}') ~ '^\d{1,2}(\.\d+)?\s*\+?$'
        THEN substring(btrim(v #>> '{}') FROM '^(\d{1,2}(?:\.\d+)?)')::numeric
    END)::int AS years
  FROM parsed
)
UPDATE public.candidate_profiles cp
SET years_experience = p.years,
    consent = jsonb_set(
      cp.consent, '{backfilled}',
      CASE WHEN jsonb_typeof(cp.consent -> 'backfilled') = 'object'
           THEN cp.consent -> 'backfilled' ELSE '{}'::jsonb END
      || jsonb_build_object('years_experience', jsonb_build_object(
           'at', now(), 'cv_file_id', cp.current_cv_file_id,
           'source', 'scripts/backfill/0001b')))
FROM proposed p
WHERE cp.id = p.id
  AND p.years BETWEEN 1 AND 60
  AND cp.years_experience IS NULL
RETURNING cp.id, cp.full_name, cp.years_experience AS years_experience_written;

COMMIT;

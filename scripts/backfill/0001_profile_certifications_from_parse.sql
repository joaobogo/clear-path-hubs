-- One-off backfill: parsed certifications (and years of experience) onto the
-- candidate profile. NOT a migration: run by hand, dry run first.
-- Rollback: see the RETURNING output of step 2; every row changed had an empty
-- value before, so restoring is `SET certifications = '[]'::jsonb` (or
-- `years_experience = NULL`) for the returned ids.
--
-- CV hydration kept certifications and years_of_experience only under
-- candidate_profiles.consent->'extracted'. The client workspace reads the
-- profile columns, so parsed certificates never reached anyone (Hughes
-- research item 5: Vijay's two mushroom courses, Daim's IOSH and LANTRA,
-- Anna's twelve incl. HACCP/FSSC, Chiedza's driving licence). The pipeline now
-- fills these columns itself (src/lib/cv/profile-backfill.ts); this script
-- repairs profiles parsed before that change.
--
-- Same rules as the code:
--   * only a profile whose column is empty (NULL or []) is written; a value
--     entered by the candidate or a recruiter is never replaced;
--   * a field named in consent.locked_fields, or whose provenance source is
--     admin_corrected / user_confirmed, is left alone even when empty;
--   * certifications are written in the shape the client DTO reads,
--     {"name", "issuer", "date"}; a parsed string becomes the name, blank
--     entries are dropped, repeats (same name, any case) kept once, max 50;
--   * years of experience rounds down and must be 1..60.
-- Idempotent: a second run finds nothing to change. No trigger on
-- candidate_profiles invalidates scores for these columns (only a new CV does),
-- and the scorer reads CV text, not these columns: no score moves.
--
-- The parser's output is copied as-is. Review the dry run before applying:
-- the model sometimes files awards or noise under certifications.

-- ─── 1a. DRY RUN: certifications ─────────────────────────────────────────────
WITH candidates AS (
  SELECT cp.id, cp.full_name, cp.certifications AS current_certifications,
         cp.consent -> 'extracted' -> 'certifications' AS parsed
  FROM public.candidate_profiles cp
  WHERE (cp.certifications IS NULL OR cp.certifications = '[]'::jsonb)
    AND jsonb_typeof(cp.consent -> 'extracted' -> 'certifications') = 'array'
    AND NOT coalesce(cp.consent -> 'locked_fields' @> '["certifications"]'::jsonb, false)
    AND coalesce(cp.consent -> 'provenance' -> 'certifications' ->> 'source', '')
        NOT IN ('admin_corrected', 'user_confirmed')
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
  WHERE name IS NOT NULL AND name <> ''
  ORDER BY id, lower(name), ord
),
proposed AS (
  SELECT id, jsonb_agg(jsonb_build_object('name', name, 'issuer', issuer, 'date', date) ORDER BY ord) AS certs
  FROM (SELECT d.*, row_number() OVER (PARTITION BY id ORDER BY ord) AS rn FROM deduped d) x
  WHERE rn <= 50
  GROUP BY id
)
SELECT c.id, c.full_name, c.current_certifications,
       jsonb_array_length(p.certs) AS proposed_count, p.certs AS proposed_certifications
FROM candidates c
JOIN proposed p ON p.id = c.id
ORDER BY c.full_name;

-- ─── 1b. DRY RUN: years of experience ────────────────────────────────────────
WITH parsed AS (
  SELECT cp.id, cp.full_name, cp.consent -> 'extracted' -> 'years_of_experience' AS v
  FROM public.candidate_profiles cp
  WHERE cp.years_experience IS NULL
    AND NOT coalesce(cp.consent -> 'locked_fields' @> '["years_experience"]'::jsonb, false)
    AND NOT coalesce(cp.consent -> 'locked_fields' @> '["years_of_experience"]'::jsonb, false)
    AND coalesce(cp.consent -> 'provenance' -> 'years_experience' ->> 'source', '')
        NOT IN ('admin_corrected', 'user_confirmed')
    AND coalesce(cp.consent -> 'provenance' -> 'years_of_experience' ->> 'source', '')
        NOT IN ('admin_corrected', 'user_confirmed')
),
proposed AS (
  SELECT id, full_name, v,
    floor(CASE
      WHEN jsonb_typeof(v) = 'number' THEN (v #>> '{}')::numeric
      WHEN jsonb_typeof(v) = 'string' AND btrim(v #>> '{}') ~ '^\d{1,2}(\.\d+)?\s*\+?$'
        THEN substring(btrim(v #>> '{}') FROM '^(\d{1,2}(?:\.\d+)?)')::numeric
    END)::int AS years
  FROM parsed
)
SELECT id, full_name, v AS parsed_years_of_experience, years AS proposed_years_experience
FROM proposed
WHERE years BETWEEN 1 AND 60
ORDER BY full_name;

-- ─── 2. APPLY (only after reviewing step 1) ──────────────────────────────────
BEGIN;

WITH candidates AS (
  SELECT cp.id, cp.consent -> 'extracted' -> 'certifications' AS parsed
  FROM public.candidate_profiles cp
  WHERE (cp.certifications IS NULL OR cp.certifications = '[]'::jsonb)
    AND jsonb_typeof(cp.consent -> 'extracted' -> 'certifications') = 'array'
    AND NOT coalesce(cp.consent -> 'locked_fields' @> '["certifications"]'::jsonb, false)
    AND coalesce(cp.consent -> 'provenance' -> 'certifications' ->> 'source', '')
        NOT IN ('admin_corrected', 'user_confirmed')
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
  WHERE name IS NOT NULL AND name <> ''
  ORDER BY id, lower(name), ord
),
proposed AS (
  SELECT id, jsonb_agg(jsonb_build_object('name', name, 'issuer', issuer, 'date', date) ORDER BY ord) AS certs
  FROM (SELECT d.*, row_number() OVER (PARTITION BY id ORDER BY ord) AS rn FROM deduped d) x
  WHERE rn <= 50
  GROUP BY id
)
UPDATE public.candidate_profiles cp
SET certifications = p.certs
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
SET years_experience = p.years
FROM proposed p
WHERE cp.id = p.id
  AND p.years BETWEEN 1 AND 60
  AND cp.years_experience IS NULL
RETURNING cp.id, cp.full_name, cp.years_experience AS years_experience_written;

COMMIT;

-- One-off backfill, part A of 2: DRY RUN. Read-only: this file holds SELECTs
-- only, so running the whole file (SQL editor "Run", query_database) changes
-- nothing. Review its output, then run 0001b_profile_certifications_apply.sql,
-- which repeats exactly these rules and writes. NOT a migration.
--
-- CV hydration kept certifications and years_of_experience only under
-- candidate_profiles.consent->'extracted'. The client workspace reads the
-- profile columns, so parsed certificates never reached anyone (Hughes
-- research item 5: Vijay's two mushroom courses, Daim's IOSH and LANTRA,
-- Anna's twelve incl. HACCP/FSSC, Chiedza's driving licence). The pipeline now
-- fills these columns itself (src/lib/cv/profile-backfill.ts); this script
-- repairs profiles parsed before that change.
--
-- Same rules as the code (planProfileBackfill / normalizeParsedCertifications):
--   * only a profile whose column is empty (NULL or []) is written; a value
--     entered by the candidate or a recruiter is never replaced;
--   * a field named in consent.locked_fields, or whose provenance source is
--     admin_corrected / user_confirmed, is left alone even when empty;
--   * a field already filled once from the profile's current CV
--     (consent.backfilled.<field>.cv_file_id) is left alone: a person may have
--     cleared it since;
--   * a parsed certification list whose hydration confidence is below 0.8 is
--     not copied at all (MIN_CERTIFICATION_CONFIDENCE);
--   * parser noise is dropped: names under 3 characters, a single word of at
--     most 6 characters with no digit and fewer than two capitals ("Shorts";
--     "HACCP", "IOSH" stay), and award lines (Effie, Cannes Lions, grand prix,
--     shortlist, finalist, winner, nominee, honourable mention, or "award" with
--     gold/silver/bronze);
--   * certifications are written in the shape the client DTO reads,
--     {"name", "issuer", "date"}; a parsed string becomes the name, blank
--     entries are dropped, repeats (same name, any case) kept once, max 50;
--   * years of experience rounds down and must be 1..60.

-- ─── 1a. certifications ──────────────────────────────────────────────────────
WITH candidates AS (
  SELECT cp.id, cp.full_name, cp.certifications AS current_certifications,
         cp.consent -> 'extracted' -> 'certifications' AS parsed,
         cp.consent -> 'provenance' -> 'certifications' -> 'confidence' AS parsed_confidence
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
SELECT c.id, c.full_name, c.parsed_confidence, c.current_certifications,
       jsonb_array_length(c.parsed) AS parsed_count,
       jsonb_array_length(p.certs) AS proposed_count, p.certs AS proposed_certifications
FROM candidates c
JOIN proposed p ON p.id = c.id
ORDER BY c.full_name;

-- ─── 1b. years of experience ─────────────────────────────────────────────────
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
    AND NOT (coalesce(jsonb_typeof(cp.consent -> 'backfilled' -> 'years_experience'), 'null') <> 'null'
             AND (cp.consent -> 'backfilled' -> 'years_experience' ->> 'cv_file_id')
                 IS NOT DISTINCT FROM cp.current_cv_file_id::text)
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

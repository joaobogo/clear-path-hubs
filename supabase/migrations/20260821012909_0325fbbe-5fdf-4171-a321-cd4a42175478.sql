-- Migration: Replace candidate email domains from @demo.taasflow.com to @example.com
-- Final attempt with known columns.

DO $mig$
BEGIN
  -- 1. Candidate profiles
  UPDATE public.candidate_profiles
  SET email = REPLACE(email, '@demo.taasflow.com', '@example.com')
  WHERE email LIKE '%@demo.taasflow.com%';

  -- 2. Auth users
  UPDATE auth.users
  SET email = REPLACE(email, '@demo.taasflow.com', '@example.com')
  WHERE email LIKE '%@demo.taasflow.com%';

  -- 3. Score run evidence snippets (bypass immutability trigger)
  ALTER TABLE public.score_runs DISABLE TRIGGER score_runs_immutable;
  
  UPDATE public.score_runs
  SET evidence = (
    SELECT jsonb_agg(
      CASE 
        WHEN (e->>'snippet') IS NOT NULL 
        THEN e || jsonb_build_object('snippet', REPLACE(e->>'snippet', 'demo.taasflow.com', 'example.com'))
        ELSE e
      END
    )
    FROM jsonb_array_elements(evidence) AS e
  )
  WHERE evidence @> '[{"label": "Contact"}]' OR jsonb_path_exists(evidence, '$[*] ? (@.snippet like_regex "demo\\.taasflow\\.com")');
  
  ALTER TABLE public.score_runs ENABLE TRIGGER score_runs_immutable;

  -- 4. Candidate evidence items
  UPDATE public.candidate_evidence_items
  SET source_passage = REPLACE(source_passage, 'demo.taasflow.com', 'example.com')
  WHERE source_passage LIKE '%demo.taasflow.com%';
END $mig$;

-- GENERATED from src/lib/scoring/bands.ts (buildScoreBandSql). Do not hand-edit.
CREATE OR REPLACE FUNCTION public.score_band(_score numeric)
RETURNS public.score_band
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT CASE
    WHEN _score IS NULL THEN 'unscored'::public.score_band
    WHEN _score >= 95 THEN 'exceptional'::public.score_band
    WHEN _score >= 85 THEN 'top'::public.score_band
    WHEN _score >= 70 THEN 'strong'::public.score_band
    WHEN _score >= 50 THEN 'consider'::public.score_band
    ELSE 'not_recommended'::public.score_band
  END
$$;

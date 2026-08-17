-- Follow-up corrective scrub for Northwind Talent briefings (P-010, P-037)
-- Replaces "Flow Group Ventures" with "Northwind Talent" everywhere inside the insights JSONB
-- for the same Northwind organization. Same table, same org, no widening.

UPDATE public.candidate_evidence
SET extracted = jsonb_set(
  extracted,
  '{insights}',
  replace((extracted->'insights')::text, 'Flow Group Ventures', 'Northwind Talent')::jsonb
)
WHERE candidate_match_id IN (
  SELECT id FROM public.candidate_matches WHERE organization_id = '0c86fa1b-94ee-46b8-9a11-a42cee39bfed'
)
AND extracted->'insights' IS NOT NULL
AND (extracted->'insights')::text LIKE '%Flow Group Ventures%';

-- Corrective data hygiene for Northwind Talent (P-010, P-037)
-- Applies only to organization_id = 0c86fa1b-94ee-46b8-9a11-a42cee39bfed

-- Correct the Northwind organization record
UPDATE public.organizations
SET
  website = 'northwindtalent.com',
  primary_contact_email = 'client.james@northwind.com'
WHERE id = '0c86fa1b-94ee-46b8-9a11-a42cee39bfed';

-- Scrub "Flow Group Ventures" from existing Northwind briefings.
-- Each update is wrapped so rows without the specific JSON path are skipped safely.
UPDATE public.candidate_evidence
SET extracted = jsonb_set(
  extracted,
  '{insights,narrative}',
  to_jsonb(replace(extracted->'insights'->>'narrative', 'Flow Group Ventures', 'Northwind Talent'))
)
WHERE candidate_match_id IN (
  SELECT id FROM public.candidate_matches WHERE organization_id = '0c86fa1b-94ee-46b8-9a11-a42cee39bfed'
)
AND extracted->'insights'->>'narrative' LIKE '%Flow Group Ventures%';

UPDATE public.candidate_evidence
SET extracted = jsonb_set(
  extracted,
  '{insights,pitch_summary}',
  to_jsonb(replace(extracted->'insights'->>'pitch_summary', 'Flow Group Ventures', 'Northwind Talent'))
)
WHERE candidate_match_id IN (
  SELECT id FROM public.candidate_matches WHERE organization_id = '0c86fa1b-94ee-46b8-9a11-a42cee39bfed'
)
AND extracted->'insights'->>'pitch_summary' LIKE '%Flow Group Ventures%';

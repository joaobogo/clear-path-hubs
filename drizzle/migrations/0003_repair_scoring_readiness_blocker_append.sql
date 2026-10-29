-- Repair text-array concatenation without changing readiness rules or grants.
-- Rollback: replace array_append(blockers, '<code>') with the original concatenation.
DO $repair$
DECLARE definition text; blocker text;
BEGIN
  SELECT pg_get_functiondef('public.scoring_readiness(uuid)'::regprocedure) INTO definition;
  FOREACH blocker IN ARRAY ARRAY['position_not_found','requirements_missing','tenant_mismatch','candidate_profile_not_found','cv_missing','cv_file_missing','cv_unparsed'] LOOP
    definition := replace(definition, 'blockers := blockers || ' || quote_literal(blocker) || ';', 'blockers := array_append(blockers, ' || quote_literal(blocker) || ');');
  END LOOP;
  definition := replace(definition, 'blockers := blockers || (''position_status:'' || p.status);', 'blockers := array_append(blockers, ''position_status:'' || p.status);');
  EXECUTE definition;
END
$repair$;

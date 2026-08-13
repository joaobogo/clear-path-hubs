UPDATE public.candidate_profiles cp
SET linkedin_url = 'https://www.linkedin.com/in/' || regexp_replace(lower(translate(cp.full_name, 'áàãâéêíóõôúçÁÀÃÂÉÊÍÓÕÔÚÇ', 'aaaaeeioooucAAAAEEIOOOUC')), '[^a-z0-9]+', '-', 'g') || '-demo',
    updated_at = now()
WHERE cp.linkedin_url IS NULL
  AND cp.id IN (
    SELECT cm.candidate_profile_id
    FROM public.candidate_matches cm
    JOIN public.positions p ON p.id = cm.position_id
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE o.name ILIKE '%Northwind%'
  );
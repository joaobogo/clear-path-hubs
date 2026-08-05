UPDATE public.organizations
SET archived_at = NULL, status = 'active', dashboard_status = 'active', updated_at = now()
WHERE id = 'f55e9b3b-75a8-486e-ab66-c496adcdfc89' AND archived_at IS NOT NULL;
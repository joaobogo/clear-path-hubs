-- Rename the demo workspace and mark it active
UPDATE public.organizations
SET name = 'Northwind Talent (Demo)',
    status = 'active'
WHERE id = '0c86fa1b-94ee-46b8-9a11-a42cee39bfed';

-- Profile for the demo login
INSERT INTO public.profiles (auth_user_id, full_name, email, status)
VALUES ('1fa5f7ca-da0c-4b88-ae73-a87ef20d35be', 'Demo Client Admin', 'demo@taasflow.com', 'active')
ON CONFLICT (auth_user_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;

-- Client admin membership in the demo workspace, with the full client permission set
INSERT INTO public.memberships (user_id, organization_id, role, status, permissions)
VALUES (
  '1fa5f7ca-da0c-4b88-ae73-a87ef20d35be',
  '0c86fa1b-94ee-46b8-9a11-a42cee39bfed',
  'client_admin',
  'active',
  public.default_permissions_for_role('client_admin')
)
ON CONFLICT DO NOTHING;
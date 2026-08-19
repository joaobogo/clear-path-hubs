INSERT INTO public.organizations (id, name, status, is_internal, is_test_record, is_demo, is_qa, archived_at, created_at)
VALUES ('f55e9b3b-75a8-486e-ab66-c496adcdfc89','TaaSFlow Platform','archived',true,false,false,false,now(),now())
ON CONFLICT (id) DO UPDATE SET is_internal = true, is_test_record = false, status = 'archived';

INSERT INTO public.memberships (user_id, organization_id, role, status, is_master_admin)
SELECT p.auth_user_id, 'f55e9b3b-75a8-486e-ab66-c496adcdfc89', 'platform_admin'::membership_role, 'active'::membership_status,
       (p.email = 'joaoluciano9812@gmail.com')
FROM public.profiles p
WHERE p.email IN (
  'joaoluciano9812@gmail.com',
  'christian.brogger@taasflow.com',
  'alex.rivera@taasflow.com',
  'fabiana.gomes@taasflow.com',
  'staff.james@taasflow.com'
)
AND NOT EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.user_id = p.auth_user_id AND m.organization_id = 'f55e9b3b-75a8-486e-ab66-c496adcdfc89'
);

-- Confirm email, set password, create profile + platform_admin membership for kasprzakjoao@protonmail.com
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
    encrypted_password = crypt('Taasflow2026!', gen_salt('bf')),
    updated_at = now()
WHERE id = '5a410b49-d628-43aa-aeab-8aa682e59743';

INSERT INTO public.profiles (auth_user_id, email, full_name, status)
VALUES ('5a410b49-d628-43aa-aeab-8aa682e59743', 'kasprzakjoao@protonmail.com', 'Joao Kasprzak', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO public.memberships (user_id, organization_id, role, status)
VALUES ('5a410b49-d628-43aa-aeab-8aa682e59743', '5ee0080b-0748-4500-a6f1-aa9e4def029c', 'platform_admin', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT '5a410b49-d628-43aa-aeab-8aa682e59743', 'admin'::public.app_role
WHERE EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typname='app_role' AND e.enumlabel='admin')
ON CONFLICT DO NOTHING;

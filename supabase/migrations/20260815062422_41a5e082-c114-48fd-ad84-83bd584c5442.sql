BEGIN;

-- 1. Fix Position titles
UPDATE public.positions
SET title = 'Structural Engineer'
WHERE title IN ('Structual Engineer', 'Structural Enginer');

-- 2. Fix Flow Group Ventures domain
UPDATE public.organizations
SET domain = 'flowgroupventures.com'
WHERE name = 'Flow Group Ventures' AND domain = 'taasflow.com';

-- 3. Fix locations
UPDATE public.positions
SET location = 'London, UK'
WHERE title = 'Front Office Manager' AND location = 'string';

UPDATE public.positions
SET location = 'Remote'
WHERE title = 'Customer Success' AND location = 'TBD';

-- 4. Re-verify the James Cameron situation (Profiles and Memberships)
-- The user says James Cameron exists as both staff and client contact.
-- I need to ensure the two profiles have distinct names/emails.
-- Profile 1: james cameron (joao_9812@hotmail.com)
-- Profile 2: james cameron (kasprzakjoao@protonmail.com)

UPDATE public.profiles
SET full_name = 'James Cameron (Staff)', email = 'staff.james@taasflow.com'
WHERE id = '087197bd-0ff1-4392-9d0b-aa3f95610d01';

UPDATE public.profiles
SET full_name = 'James Cameron (Client)', email = 'client.james@northwind.com'
WHERE id = 'ab759b37-457c-4093-b1d1-fb6468accd06';

COMMIT;

-- Verification Queries
SELECT p.title, o.name as client_name, p.location
FROM public.positions p
JOIN public.organizations o ON p.organization_id = o.id
WHERE p.title IN ('Structural Engineer', 'Front Office Manager', 'Customer Success')
OR p.title ILIKE '%Structual%'
OR p.title ILIKE '%Enginer%';

SELECT name, domain FROM public.organizations WHERE name = 'Flow Group Ventures';

SELECT id, full_name, email FROM public.profiles WHERE full_name ILIKE '%James Cameron%';

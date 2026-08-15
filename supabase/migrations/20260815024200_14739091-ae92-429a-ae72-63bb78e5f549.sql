
-- 1. Fix typos in role titles
UPDATE public.positions 
SET title = 'Structural Engineer' 
WHERE title IN ('Structual Engineer', 'Structural Enginer');

-- 2. Fix placeholder locations
UPDATE public.positions 
SET location = 'London, UK' 
WHERE title = 'Front Office Manager' AND location = 'string';

UPDATE public.positions 
SET location = NULL 
WHERE title = 'Customer Success' AND location = 'TBD';

-- 3. Flow Group Ventures domain update
UPDATE public.organizations 
SET domain = 'flowgroup.ventures' 
WHERE name = 'Flow Group Ventures';

-- 4. James Cameron persona split
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data || '{"full_name": "James Cameron (Staff)"}'::jsonb
WHERE id = '53600517-263a-47cc-aad2-bfe9d58c0873';

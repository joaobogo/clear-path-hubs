-- Purge leaked QA/browser-test fixtures from the Northwind demo workspace and
-- clean the (Staff) suffix from internal profile names so clients never see it.
-- Rollback: none; this is a destructive data-correction migration.

BEGIN;

-- 1. Delete the leaked "Senior back end" position (no related rows).
DELETE FROM public.positions
WHERE id = 'c76c966d-f55e-4fdf-8956-dcb33eac970e';

-- 2. Delete the standalone "History Integrity Test" conversation (no messages).
DELETE FROM public.conversations
WHERE id = 'b8fed916-f5a5-4a22-8c03-c6381c081a7c';

-- 3. Delete QA/browser-test messages embedded in a real client conversation.
DELETE FROM public.messages
WHERE id IN (
  '5534e350-a458-41ad-a054-00c2661b5d3f',
  '7768e7c1-70a7-4951-b26a-1663907c38c0',
  'db7fdcb2-1e64-4d9c-bd3e-c4a3a2dcbd66',
  '82094c07-dfb9-45b2-936d-8e30238194fb',
  '08b61d0f-dff5-4796-9776-de7d370b52eb',
  '05802a93-d45a-4923-a351-7fe1b58bc6e9',
  '9e677ab9-e878-4054-94e9-a1007bc8fe03',
  '976a712a-51e3-43bf-a96e-04d4055d2ad2'
);

-- 4. Remove the (Staff) suffix from internal staff profile names.
UPDATE public.profiles
SET full_name = TRIM(REPLACE(full_name, '(Staff)', ''))
WHERE full_name ILIKE '%(Staff)%';

COMMIT;

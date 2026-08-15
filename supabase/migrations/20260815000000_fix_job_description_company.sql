-- Fix job descriptions naming the wrong company
UPDATE public.positions
SET description = REPLACE(description, 'Flow Group Ventures is hiring', 'Northwind Talent is hiring')
WHERE id = 'ee6d2a82-6122-4026-95e4-45a7821b7b7d';

-- Generic fix for any other Northwind Talent positions that might have wrong text
UPDATE public.positions
SET description = REPLACE(description, 'Flow Group Ventures is hiring', 'Northwind Talent is hiring')
WHERE organization_id IN (SELECT id FROM public.organizations WHERE name = 'Northwind Talent (Demo)')
  AND description LIKE '%Flow Group Ventures is hiring%';

-- Fallback for other orgs
UPDATE public.positions
SET description = REPLACE(description, 'Flow Group Ventures is hiring', 'Our client is hiring')
WHERE organization_id NOT IN (SELECT id FROM public.organizations WHERE name = 'Flow Group Ventures')
  AND organization_id NOT IN (SELECT id FROM public.organizations WHERE name = 'Northwind Talent (Demo)')
  AND description LIKE '%Flow Group Ventures is hiring%';

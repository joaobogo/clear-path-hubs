-- Mark identified fixture roles as test records to hide them from the client view.
UPDATE public.positions SET is_test_record = true WHERE id IN (
  '95d5ea69-cd52-4280-bfab-06b78c3e3616', -- [QA test — ignore] QA Role Aug 17 v2
  'a912224d-3b58-4ac6-adf1-ae679f01da2b', -- BROWSER-TEST-R2 Admin Position
  'a85d8f5f-a278-42e4-9fe0-cee6102a2f7d', -- BROWSER-TEST-R2 Position
  '02d15b86-e845-4138-92d2-d1f43f88b73e', -- BROWSER-TEST-R3 Position
  'c76c966d-f55e-4fdf-8956-dcb33eac970e'  -- Senior back end
);

-- Mark applications for these roles as test records.
UPDATE public.applications SET is_test_record = true WHERE position_id IN (
  '95d5ea69-cd52-4280-bfab-06b78c3e3616',
  'a912224d-3b58-4ac6-adf1-ae679f01da2b',
  'a85d8f5f-a278-42e4-9fe0-cee6102a2f7d',
  '02d15b86-e845-4138-92d2-d1f43f88b73e',
  'c76c966d-f55e-4fdf-8956-dcb33eac970e'
);

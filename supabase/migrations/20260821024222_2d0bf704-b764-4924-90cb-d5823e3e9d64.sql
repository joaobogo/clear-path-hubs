ALTER TABLE public.profiles ALTER COLUMN show_test_records SET DEFAULT false;
UPDATE public.profiles SET show_test_records = false WHERE show_test_records IS TRUE;
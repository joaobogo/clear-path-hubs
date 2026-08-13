-- Demo funnel completeness: the Northwind Talent (Demo) hire and offer carry
-- agreed terms so the handoff view reads as a real placement instead of
-- "Not recorded" placeholders. Additive: only fills columns that are NULL.
--
-- ROLLBACK:
--   UPDATE public.hire_records SET start_date = NULL, salary_amount = NULL,
--     salary_currency = NULL, salary_period = NULL, employment_type = NULL,
--     work_model = NULL, location = NULL, offer_notes = NULL
--   WHERE id IN ('738ec9ba-a937-48ad-ad12-a6546a1050ab',
--                '9c375c89-afe7-4843-b678-d4324fe4525e');

UPDATE public.hire_records
SET start_date = COALESCE(start_date, DATE '2026-09-01'),
    salary_amount = COALESCE(salary_amount, 68000),
    salary_currency = COALESCE(salary_currency, 'EUR'),
    salary_period = COALESCE(salary_period, 'year'),
    employment_type = COALESCE(employment_type, 'full_time'),
    work_model = COALESCE(work_model, 'hybrid'),
    location = COALESCE(location, 'Lisbon, Portugal'),
    offer_notes = COALESCE(offer_notes, 'Offer accepted. Two days on site each week.')
WHERE id = '738ec9ba-a937-48ad-ad12-a6546a1050ab';

UPDATE public.hire_records
SET start_date = COALESCE(start_date, DATE '2026-09-15'),
    salary_amount = COALESCE(salary_amount, 64000),
    salary_currency = COALESCE(salary_currency, 'EUR'),
    salary_period = COALESCE(salary_period, 'year'),
    employment_type = COALESCE(employment_type, 'full_time'),
    work_model = COALESCE(work_model, 'hybrid'),
    location = COALESCE(location, 'Lisbon, Portugal'),
    offer_notes = COALESCE(offer_notes, 'Offer sent, awaiting response.')
WHERE id = '9c375c89-afe7-4843-b678-d4324fe4525e';
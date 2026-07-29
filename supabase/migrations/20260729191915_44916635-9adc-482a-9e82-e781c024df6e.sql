delete from public.screening_questions
where position_id='4cf3979b-170e-424d-9afa-d02c9c9565a3'
  and id in (
    '549ed096-bb00-4c37-a034-778468334db8',
    'c1b755cd-8929-43da-8a7c-fbdba1b740ea',
    '23d7a0e7-2119-4e03-911b-41c98a225d75',
    '06cc9fc6-7f1f-416b-9ccc-ac92b2c03c47',
    'a3e71c3f-a3cd-427b-a0bf-abe0cc1ea5a0',
    'abbf44fc-9391-4574-ba88-e7c544f52e7b',
    '4a35bbad-2b51-4763-bbc5-2ca1f02c4394'
  );

update public.screening_questions set required = false
where position_id='4cf3979b-170e-424d-9afa-d02c9c9565a3'
  and id not in (
    '7d2a3998-f892-4b06-9609-a44af53f5fab',
    '6fb2baf3-7239-41ab-87b6-f6c1920b0b86',
    '768c8d2c-86ad-4447-b630-7387a0ef4337',
    'a4d355ed-f6c0-4bad-9de8-c1d86be3e20d'
  );

update public.screening_questions set display_order = t.ord
from (
  select id, row_number() over (order by display_order) as ord
  from public.screening_questions
  where position_id='4cf3979b-170e-424d-9afa-d02c9c9565a3'
) t
where public.screening_questions.id = t.id;
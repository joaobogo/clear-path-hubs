insert into public.candidate_profiles (user_id, email, full_name, is_test_record)
select u.id, u.email, 'QA Candidate', true
from auth.users u
where u.email in ('qa.candidate@qa.taasflow.test','qa.candidate.cross@qa.taasflow.test')
on conflict (user_id) do nothing;

delete from public.memberships
where user_id = '1fa5f7ca-da0c-4b88-ae73-a87ef20d35be'
  and organization_id = 'ef07d127-2571-4c74-8981-2d4f0f1d2c8f';
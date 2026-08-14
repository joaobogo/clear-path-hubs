-- 1. QA task
delete from public.tasks where id = '5c5c735e-d0e2-4313-a425-4033eadaa6c9';

-- 2. QA message
delete from public.messages where id = 'f0faf5be-1c81-4718-b378-40fa13b98420';

-- 6. QA interview feedback (Beatriz Costa / SFE) — keep the real hire record
delete from public.interview_scorecards where id = 'c45fba78-5cb6-4014-bb67-c03b8fbaa7a5';

-- 3/4/5. QA-driven decisions and stage reverts
delete from public.client_decisions where id = '52f23deb-76bd-4f9d-8837-2f74dd3dea2f';
delete from public.score_decisions where id = '49699ab9-5d18-4f23-bb7c-429fe6567fba';

update public.candidate_matches
   set stage = 'shortlisted', current_stage_entered_at = now(), updated_at = now()
 where id = '1ae343e0-46fd-4058-877d-4070dd803ad5';

update public.candidate_matches
   set stage = 'delivered', current_stage_entered_at = now(), updated_at = now()
 where id = 'f87e62d8-2c77-4b22-b810-4b8f5bbf6f2a';

-- Sofia: drop the QA interview request (clears the "Confirm a time" to-do), back to shortlisted
delete from public.interview_scorecards where interview_id = '565a3ce9-6302-434e-a32d-d835adf7f340';
delete from public.interviews where id = '565a3ce9-6302-434e-a32d-d835adf7f340';

update public.candidate_matches
   set stage = 'shortlisted', current_stage_entered_at = now(), updated_at = now()
 where id = '449f7f61-d367-4919-a382-2017df43076c';

-- 7. QA intake draft (BROWSER-TEST Position / third-party structural engineer data)
delete from public.intake_drafts
 where user_id = '1fa5f7ca-da0c-4b88-ae73-a87ef20d35be'
   and payload::text ilike '%BROWSER-TEST%';

-- 8. Remaining audit trail artifacts mentioning the QA marker
delete from public.audit_events where to_jsonb(audit_events)::text ilike '%BROWSER-TEST%';

BEGIN;

UPDATE public.memberships SET is_master_admin = true
 WHERE id = 'b0b24796-a527-4523-b679-d72245340ebb';

INSERT INTO public.audit_events(actor_user_id, organization_id, entity_type, entity_id, action, after_state, trace_id)
VALUES ('2619b452-d7c6-42bb-aef6-60699fd71e8c',
        '5ee0080b-0748-4500-a6f1-aa9e4def029c',
        'memberships',
        'b0b24796-a527-4523-b679-d72245340ebb',
        'master_admin_designated',
        jsonb_build_object('is_master_admin', true, 'email','kasprzakjoao@taasflow.com'),
        'PRIV-RECON-2026-07-22');

INSERT INTO public.audit_events(actor_user_id, organization_id, entity_type, entity_id, action, before_state, after_state, trace_id)
SELECT '2619b452-d7c6-42bb-aef6-60699fd71e8c', organization_id, 'memberships', id,
       'privileged_membership_deactivated',
       jsonb_build_object('status','active','role',role::text),
       jsonb_build_object('status','removed','role',role::text,'reason','QA identity revoked in privileged access reconciliation'),
       'PRIV-RECON-2026-07-22'
  FROM public.memberships
 WHERE id IN (
   '7a3c505f-dfca-472b-a372-7e82d4063d9d',
   '98330877-4237-465a-9c81-21836e9037d9',
   '9513bde5-fa55-407c-a026-ec2532f236a3',
   '30c5cc97-ffc0-413b-b030-6582ce4e5468',
   '04832879-43f7-4470-a838-8fe050a015c3',
   'c82ec1ba-e854-4e1e-b965-eaff4d2e4921',
   'fd5ef441-1f4d-46fa-bf76-462f69777c6c',
   '6bd0f6cd-9734-4dcf-8ed5-609990d3b953'
 );

UPDATE public.memberships SET status = 'removed'
 WHERE id IN (
   '7a3c505f-dfca-472b-a372-7e82d4063d9d',
   '98330877-4237-465a-9c81-21836e9037d9',
   '9513bde5-fa55-407c-a026-ec2532f236a3',
   '30c5cc97-ffc0-413b-b030-6582ce4e5468',
   '04832879-43f7-4470-a838-8fe050a015c3',
   'c82ec1ba-e854-4e1e-b965-eaff4d2e4921',
   'fd5ef441-1f4d-46fa-bf76-462f69777c6c',
   '6bd0f6cd-9734-4dcf-8ed5-609990d3b953'
 );

COMMIT;

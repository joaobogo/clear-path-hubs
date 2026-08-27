CREATE OR REPLACE VIEW public.v_activity_feed
WITH (security_invoker = on) AS
  SELECT e.id AS event_id,
     e.event_type,
     e.created_at AS occurred_at,
     e.organization_id,
     e.position_id,
     e.application_id,
     e.candidate_match_id,
     e.candidate_profile_id,
     e.actor_user_id,
     p.full_name AS actor_name,
     pos.title AS position_title,
     pos.status::text AS position_status,
     e.payload,
     (COALESCE(pos.is_test_record, false) OR COALESCE(org.is_test_record, false)) AS is_test_record
    FROM notification_events e
      LEFT JOIN profiles p ON p.auth_user_id = e.actor_user_id
      LEFT JOIN positions pos ON pos.id = e.position_id
      LEFT JOIN organizations org ON org.id = e.organization_id;
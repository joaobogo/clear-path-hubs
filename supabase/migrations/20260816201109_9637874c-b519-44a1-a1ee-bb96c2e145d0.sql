create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.cron_credentials (
  name text primary key,
  secret text not null,
  updated_at timestamptz not null default now()
);
alter table private.cron_credentials enable row level security;
revoke all on table private.cron_credentials from public, anon, authenticated;

create or replace function private.cron_invoke_headers()
returns jsonb
language sql
security definer
set search_path = private
as $$
  select jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', (select secret from private.cron_credentials where name = 'cron_invoke_secret' limit 1)
  );
$$;
revoke all on function private.cron_invoke_headers() from public, anon, authenticated;

select cron.alter_job(2, command := $c$select net.http_post(url:='https://project--1dc5ee7e-1294-441c-8288-850e79e443f6.lovable.app/api/public/pipeline/run', headers:=private.cron_invoke_headers(), body:='{"drain": true, "limit": 10}'::jsonb) as request_id;$c$);
select cron.alter_job(3, command := $c$select net.http_post(url:='https://project--1dc5ee7e-1294-441c-8288-850e79e443f6.lovable.app/api/public/digest/weekly', headers:=private.cron_invoke_headers(), body:='{}'::jsonb) as request_id;$c$);
select cron.alter_job(5, command := $c$select net.http_post(url:='https://project--1dc5ee7e-1294-441c-8288-850e79e443f6.lovable.app/api/public/candidate/interview-reminders', headers:=private.cron_invoke_headers(), body:='{}'::jsonb) as request_id;$c$);
select cron.alter_job(6, command := $c$select net.http_post(url:='https://project--1dc5ee7e-1294-441c-8288-850e79e443f6.lovable.app/api/public/candidate/profile-nudges', headers:=private.cron_invoke_headers(), body:='{}'::jsonb) as request_id;$c$);
select cron.alter_job(7, command := $c$select net.http_post(url:='https://project--1dc5ee7e-1294-441c-8288-850e79e443f6.lovable.app/api/public/scoring/reconcile-freshness', headers:=private.cron_invoke_headers(), body:='{"limit": 100}'::jsonb) as request_id;$c$);

revoke execute on function public.set_position_intensity(uuid, uuid, role_intensity) from anon;
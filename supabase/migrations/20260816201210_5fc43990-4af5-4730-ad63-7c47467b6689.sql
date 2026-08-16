create or replace function public.sync_cron_invoke_secret(_secret text)
returns void
language plpgsql
security definer
set search_path = private, public
as $$
begin
  if coalesce(_secret, '') = '' then
    raise exception 'empty_secret';
  end if;
  insert into private.cron_credentials(name, secret)
  values ('cron_invoke_secret', _secret)
  on conflict (name) do update set secret = excluded.secret, updated_at = now();
end;
$$;

revoke all on function public.sync_cron_invoke_secret(text) from public, anon, authenticated;
grant execute on function public.sync_cron_invoke_secret(text) to service_role;
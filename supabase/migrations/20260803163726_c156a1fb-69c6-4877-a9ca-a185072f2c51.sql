alter table public.contact_messages
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists consent_status text,
  add column if not exists attribution jsonb,
  add column if not exists page_context jsonb;
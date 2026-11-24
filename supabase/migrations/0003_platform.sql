-- Platform / admin panel. Run once in the Supabase SQL editor (after 0001 and 0002).
alter type admin_role add value if not exists 'user';

alter table admin_profiles
  add column if not exists status text not null default 'active' check (status in ('pending','active','suspended')),
  add column if not exists display_name text,
  add column if not exists notes text,
  add column if not exists features jsonb not null default '{}',
  add column if not exists limits jsonb not null default '{}',
  add column if not exists last_login_at timestamptz;
-- Existing admins become owners.
update admin_profiles set role = 'owner' where role = 'admin';

create table if not exists platform_settings (key text primary key, value jsonb not null default '{}', updated_at timestamptz not null default now());

create table if not exists features (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  name text not null, description text not null default '',
  enabled boolean not null default true,
  default_enabled boolean not null default true,
  builtin boolean not null default false,
  created_at timestamptz not null default now()
);
insert into features (key, name, description, builtin) values
  ('email_otp', 'Email OTP', 'Send OTP codes by email', true),
  ('whatsapp_otp', 'WhatsApp OTP', 'Send OTP codes through the platform WhatsApp number', true),
  ('api_keys', 'API keys', 'Create and manage API keys', true),
  ('project_smtp', 'Own email sender', 'Use own mailbox and app password per project', true),
  ('test_otp', 'Test OTP', 'Use the Test OTP tool', true),
  ('csv_export', 'CSV export', 'Export OTP logs as CSV', true)
on conflict (key) do nothing;

-- WhatsApp worker: the worker connects OUT to the app, so the app URL is the permanent worker URL.
create table if not exists wa_worker (
  id int primary key default 1 check (id = 1),
  token_hash text, token_enc text,
  state text not null default 'offline', qr text, phone text,
  last_seen timestamptz, updated_at timestamptz not null default now()
);
insert into wa_worker (id) values (1) on conflict do nothing;

create table if not exists wa_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('send','qr','code','logout')),
  payload text,
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  result jsonb, created_at timestamptz not null default now(), picked_at timestamptz, finished_at timestamptz
);
create index if not exists wa_jobs_queue_idx on wa_jobs(status, created_at);

alter table platform_settings enable row level security;
alter table features enable row level security;
alter table wa_worker enable row level security;
alter table wa_jobs enable row level security;

create or replace function cleanup_expired_otps() returns void
language sql security definer set search_path = public as $$
  delete from otp_requests where expires_at < now() - interval '24 hours';
  delete from wa_jobs where created_at < now() - interval '1 day';
$$;
revoke all on function cleanup_expired_otps() from public, anon, authenticated;

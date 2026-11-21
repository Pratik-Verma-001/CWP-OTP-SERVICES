create extension if not exists pgcrypto;

create type admin_role as enum ('owner','admin');
create type project_status as enum ('active','paused');
create type key_status as enum ('active','disabled','revoked');
create type otp_channel as enum ('email','whatsapp');
create type otp_status as enum ('pending','sent','failed','verified','expired','locked');
create type delivery_status as enum ('queued','sent','delivered','failed');

create table admin_profiles (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null unique,
  email text not null unique,
  role admin_role not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references admin_profiles(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  website_url text,
  description text,
  allowed_origins text[] not null default '{}',
  status project_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  prefix text not null,
  status key_status not null default 'active',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index api_keys_project_idx on api_keys(project_id);

create table otp_requests (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  api_key_id uuid not null references api_keys(id) on delete cascade,
  recipient_hash text not null,
  masked_recipient text not null,
  ip_hash text,
  channel otp_channel not null,
  otp_hash text not null,
  status otp_status not null default 'pending',
  expires_at timestamptz not null,
  attempts int not null default 0,
  max_attempts int not null default 5,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index otp_recipient_idx on otp_requests(recipient_hash, created_at desc);
create index otp_ip_idx on otp_requests(ip_hash, created_at desc);
create index otp_key_idx on otp_requests(api_key_id, created_at desc);
create index otp_project_idx on otp_requests(project_id, created_at desc);
create index otp_expiry_idx on otp_requests(expires_at) where consumed_at is null;

create table delivery_logs (
  id uuid primary key default gen_random_uuid(),
  otp_request_id uuid not null references otp_requests(id) on delete cascade,
  provider text not null,
  provider_message_id text,
  status delivery_status not null,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);
create index delivery_otp_idx on delivery_logs(otp_request_id);

create table api_usage (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  api_key_id uuid references api_keys(id) on delete cascade,
  endpoint text not null,
  status_code int not null,
  created_at timestamptz not null default now()
);
create index usage_project_idx on api_usage(project_id, created_at desc);

create table provider_settings (
  id uuid primary key default gen_random_uuid(),
  provider_name text not null unique check (provider_name in ('smtp','whatsapp')),
  enabled boolean not null default false,
  encrypted_credentials text,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references admin_profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- RLS on, no policies: only the server-side service role can access anything.
alter table admin_profiles enable row level security;
alter table projects enable row level security;
alter table api_keys enable row level security;
alter table otp_requests enable row level security;
alter table delivery_logs enable row level security;
alter table api_usage enable row level security;
alter table provider_settings enable row level security;
alter table audit_logs enable row level security;

-- Run periodically (pg_cron or a Vercel cron) to purge old OTP rows.
create or replace function cleanup_expired_otps() returns void
language sql security definer set search_path = public as $$
  delete from otp_requests where expires_at < now() - interval '24 hours';
$$;
revoke all on function cleanup_expired_otps() from public, anon, authenticated;

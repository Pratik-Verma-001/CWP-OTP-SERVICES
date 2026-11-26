-- Single dedicated admin: login attempt log (brute-force protection) + WhatsApp worker diagnostics.
create table if not exists admin_login_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  ok boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists admin_login_attempts_idx on admin_login_attempts (created_at, ip_hash);
alter table admin_login_attempts enable row level security;
alter table wa_worker
  add column if not exists last_error text,
  add column if not exists qr_at timestamptz,
  add column if not exists worker_version text;
create or replace function cleanup_expired_otps() returns void
language sql security definer set search_path = public as $$
  delete from otp_requests where expires_at < now() - interval '24 hours';
  delete from wa_jobs where created_at < now() - interval '1 day';
  delete from admin_login_attempts where created_at < now() - interval '2 days';
$$;
revoke all on function cleanup_expired_otps() from public, anon, authenticated;

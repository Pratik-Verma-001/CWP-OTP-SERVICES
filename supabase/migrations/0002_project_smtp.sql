-- Per-project email sender: each project can use its own mailbox + app password.
-- Run once in Supabase SQL editor (after 0001_init.sql).
create table if not exists project_smtp (
  project_id uuid primary key references projects(id) on delete cascade,
  enabled boolean not null default false,
  settings jsonb not null default '{}',
  encrypted_credentials text,
  updated_at timestamptz not null default now()
);
alter table project_smtp enable row level security;

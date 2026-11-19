-- App usage analytics for admin engagement metrics
create table if not exists public.app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0,
  client text,
  created_at timestamptz not null default now()
);

create index if not exists app_sessions_user_id_idx on public.app_sessions (user_id);
create index if not exists app_sessions_last_seen_idx on public.app_sessions (last_seen_at desc);
create index if not exists app_sessions_started_at_idx on public.app_sessions (started_at desc);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.app_sessions(id) on delete set null,
  feature text not null,
  event text not null default 'view',
  created_at timestamptz not null default now()
);

create index if not exists usage_events_feature_idx on public.usage_events (feature, created_at desc);
create index if not exists usage_events_user_created_idx on public.usage_events (user_id, created_at desc);
create index if not exists usage_events_created_idx on public.usage_events (created_at desc);

alter table public.app_sessions enable row level security;
alter table public.usage_events enable row level security;

drop policy if exists app_sessions_insert_own on public.app_sessions;
create policy app_sessions_insert_own on public.app_sessions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists app_sessions_update_own on public.app_sessions;
create policy app_sessions_update_own on public.app_sessions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists app_sessions_select_own on public.app_sessions;
create policy app_sessions_select_own on public.app_sessions
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists usage_events_insert_own on public.usage_events;
create policy usage_events_insert_own on public.usage_events
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists usage_events_select_own on public.usage_events;
create policy usage_events_select_own on public.usage_events
  for select to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update on public.app_sessions to authenticated;
grant select, insert on public.usage_events to authenticated;
grant all on public.app_sessions, public.usage_events to service_role;

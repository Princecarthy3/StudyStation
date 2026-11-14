-- Phase 1: notification preferences, browser push subscriptions, and deduplication.

alter table public.notifications
  add column if not exists dedupe_key text,
  add column if not exists action_url text,
  add column if not exists expires_at timestamptz;

create unique index if not exists notifications_user_dedupe_key_idx
  on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  categories jsonb not null default '{"assignments":true,"calls":true,"classes":true,"groups":true,"messages":true,"recordings":true,"system":true,"study":true}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own on public.notification_preferences
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

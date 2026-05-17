create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade not null,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz default now(),
  unique(user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "push_subs_select" on public.push_subscriptions
  for select using (auth.uid() = user_id);

create policy "push_subs_insert" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

create policy "push_subs_delete" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

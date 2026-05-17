-- Add got_compliment flag to scent logs
alter table public.scent_logs
  add column if not exists got_compliment boolean default false;

-- Manual compliment entries (separate from scent journal auto-entries)
create table if not exists public.compliment_entries (
  id                  uuid    primary key default gen_random_uuid(),
  user_id             uuid    references auth.users on delete cascade not null,
  collection_item_ids text[]  default '{}',
  perfume_names       text[]  default '{}',
  date                date    default current_date,
  created_at          timestamptz default now()
);

alter table public.compliment_entries enable row level security;

create policy "compliment_entries_select" on public.compliment_entries
  for select using (auth.uid() = user_id);

create policy "compliment_entries_insert" on public.compliment_entries
  for insert with check (auth.uid() = user_id);

create policy "compliment_entries_delete" on public.compliment_entries
  for delete using (auth.uid() = user_id);

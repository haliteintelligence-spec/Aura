-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ─── Profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Perfumes catalog ─────────────────────────────────────────────────────────
create table public.perfumes (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  brand text not null,
  year integer,
  description text,
  top_notes text[] default '{}',
  heart_notes text[] default '{}',
  base_notes text[] default '{}',
  fragrance_family text[] default '{}',
  gender text,
  image_url text,
  created_at timestamptz default now()
);

alter table public.perfumes enable row level security;
create policy "Anyone can read perfumes" on public.perfumes for select using (true);
create policy "Authenticated users can insert perfumes" on public.perfumes for insert with check (auth.uid() is not null);

-- ─── Collection items ─────────────────────────────────────────────────────────
create table public.collection_items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  perfume_id uuid references public.perfumes on delete cascade not null,
  collection_type text not null check (collection_type in ('closet', 'wishlist', 'owned_before')),
  bottle_sizes text[] default '{}',
  size_prices jsonb default '[]',
  occasions text[] default '{}',
  seasons text[] default '{}',
  rating numeric(3,1),
  notes text,
  initial_level text default 'full',
  estimated_level text default 'full',
  available_for_swap boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.collection_items enable row level security;
create policy "Users can manage own collection" on public.collection_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Scent logs ───────────────────────────────────────────────────────────────
create table public.scent_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  collection_item_ids uuid[] default '{}',
  date date not null default current_date,
  mood text[] default '{}',
  event_type text,
  rating numeric(3,1),
  duration text,
  notes text,
  created_at timestamptz default now()
);

alter table public.scent_logs enable row level security;
create policy "Users can manage own logs" on public.scent_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Layer combos ─────────────────────────────────────────────────────────────
create table public.layer_combos (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text,
  collection_item_ids uuid[] default '{}',
  occasion text[] default '{}',
  season text[] default '{}',
  mood text[] default '{}',
  intensity_longevity integer default 5,
  intensity_sillage integer default 5,
  combined_profile text,
  saved boolean default false,
  created_at timestamptz default now()
);

alter table public.layer_combos enable row level security;
create policy "Users can manage own combos" on public.layer_combos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Badges ───────────────────────────────────────────────────────────────────
create table public.badges (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text not null,
  icon text not null,
  threshold_type text not null,
  threshold_value integer not null
);

insert into public.badges (name, description, icon, threshold_type, threshold_value) values
  ('First Spritz', 'Added your first perfume to the collection', '🌸', 'collection_count', 1),
  ('Growing Collection', 'Added 10 perfumes to your closet', '🌷', 'collection_count', 10),
  ('Connoisseur', 'Added 25 perfumes to your collection', '🏺', 'collection_count', 25),
  ('Century Club', 'Logged 100 scent entries', '📖', 'log_count', 100),
  ('Daily Devotee', 'Logged scents 30 days in a row', '📅', 'streak_days', 30),
  ('Note Explorer', 'Tried all major fragrance families', '🌍', 'families_explored', 10),
  ('Layering Artist', 'Created 10 perfume combinations', '🎨', 'combo_count', 10),
  ('Scent Sharer', 'Listed a perfume for swap', '🤝', 'swap_count', 1),
  ('Niche Devotee', 'Added 5 niche brand perfumes', '💎', 'niche_count', 5);

alter table public.badges enable row level security;
create policy "Anyone can read badges" on public.badges for select using (true);

create table public.user_badges (
  user_id uuid references auth.users on delete cascade,
  badge_id uuid references public.badges on delete cascade,
  earned_at timestamptz default now(),
  primary key (user_id, badge_id)
);

alter table public.user_badges enable row level security;
create policy "Users can read own badges" on public.user_badges for select using (auth.uid() = user_id);
create policy "System can insert badges" on public.user_badges for insert with check (auth.uid() = user_id);

-- ─── Swap listings ────────────────────────────────────────────────────────────
create table public.swap_listings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  collection_item_id uuid references public.collection_items on delete cascade not null,
  status text default 'available' check (status in ('available', 'pending', 'completed')),
  description text,
  created_at timestamptz default now()
);

alter table public.swap_listings enable row level security;
create policy "Anyone can read available swaps" on public.swap_listings
  for select using (status = 'available');
create policy "Users can manage own swap listings" on public.swap_listings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index idx_collection_items_user on public.collection_items (user_id);
create index idx_collection_items_type on public.collection_items (user_id, collection_type);
create index idx_scent_logs_user_date on public.scent_logs (user_id, date desc);
create index idx_swap_listings_status on public.swap_listings (status);

-- user_perfumes: user-owned fragrance records that live outside the public catalog.
-- When a user adds a perfume not found in public.perfumes, it goes here so that
-- public.perfumes stays a clean, shared, read-only search catalog.

create table public.user_perfumes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
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
  product_type text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Each user can only have one entry per (name, brand) pair.
alter table public.user_perfumes
  add constraint user_perfumes_user_name_brand_unique unique (user_id, name, brand);

alter table public.user_perfumes enable row level security;
create policy "Users can manage own user_perfumes" on public.user_perfumes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_user_perfumes_user on public.user_perfumes (user_id);

-- ── Modify collection_items to support both public and user-owned perfumes ─────

-- Allow perfume_id to be null so collection_items can reference user_perfumes
alter table public.collection_items alter column perfume_id drop not null;

-- FK to user_perfumes
alter table public.collection_items
  add column user_perfume_id uuid references public.user_perfumes(id) on delete cascade;

-- Exactly one source must be set per row
alter table public.collection_items
  add constraint collection_items_perfume_source_check check (
    (perfume_id is not null and user_perfume_id is null)
    or  (perfume_id is null and user_perfume_id is not null)
  );

create index idx_collection_items_user_perfume on public.collection_items (user_perfume_id);

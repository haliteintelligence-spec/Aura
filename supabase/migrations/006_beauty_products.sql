-- Beauty products catalog: skincare, body care, hair care, candles, home fragrance
-- Separate from the fragrances (perfumes) table.
-- category values: 'skincare' | 'bodycare' | 'haircare' | 'candle' | 'home_fragrance' | 'other'

create table if not exists public.beauty_products (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  brand            text not null,
  category         text not null,          -- skincare | bodycare | haircare | candle | home_fragrance | other
  subcategory      text,                   -- e.g. serum, moisturizer, body lotion, body wash, shampoo, conditioner
  description      text,
  key_ingredients  text[]  default '{}',   -- key / hero ingredients
  scent_notes      text[]  default '{}',   -- scent notes for products that have a fragrance profile
  image_url        text,
  prices           jsonb   default '[]',   -- [{"size":"200ml","price_min":35,"price_max":35,"currency":"USD"}]
  tags             text[]  default '{}',   -- e.g. ["vegan","cruelty-free","clean"]
  source_url       text,                   -- product page URL scraped from
  created_at       timestamptz default now()
);

-- Unique on (brand, name) — same product from same brand is one row
alter table public.beauty_products
  add constraint beauty_products_brand_name_key unique (brand, name);

-- Indexes for typical query patterns
create index if not exists beauty_products_brand_idx    on public.beauty_products (lower(brand));
create index if not exists beauty_products_category_idx on public.beauty_products (category);
create index if not exists beauty_products_name_idx     on public.beauty_products using gin (to_tsvector('english', name));

-- RLS: public read, service-role write
alter table public.beauty_products enable row level security;

create policy "beauty_products_public_read"
  on public.beauty_products for select
  using (true);

create policy "beauty_products_service_write"
  on public.beauty_products for all
  using (auth.role() = 'service_role');

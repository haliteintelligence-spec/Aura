-- Add prices JSONB column to perfumes catalog
-- Format: [{"size": "50ml", "price": 105.00, "currency": "USD"}, ...]

alter table public.perfumes add column if not exists prices jsonb default '[]';

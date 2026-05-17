-- Add 'fragrance' as a valid beauty_products category for hair/body mists and sprays.
-- category values: 'skincare' | 'bodycare' | 'haircare' | 'candle' | 'home_fragrance' | 'fragrance' | 'other'

-- Backfill existing beauty_products rows that are hair/body mists or body sprays
update public.beauty_products
set
  category    = 'fragrance',
  subcategory = case
    when name  ilike '%hair mist%'   or subcategory ilike '%hair mist%'   then 'hair mist'
    when name  ilike '%hair perfume%' or subcategory ilike '%hair perfume%' then 'hair mist'
    when name  ilike '%hair spray%'  or subcategory ilike '%hair spray%'   then 'hair mist'
    when name  ilike '%body mist%'   or subcategory ilike '%body mist%'    then 'body mist'
    when name  ilike '%body spray%'  or subcategory ilike '%body spray%'   then 'body mist'
    else subcategory
  end
where
  category in ('haircare', 'bodycare')
  and (
    name       ilike '%hair mist%'
    or name    ilike '%hair perfume%'
    or name    ilike '%hair spray%'
    or name    ilike '%body mist%'
    or name    ilike '%body spray%'
    or subcategory ilike '%hair mist%'
    or subcategory ilike '%hair perfume%'
    or subcategory ilike '%hair spray%'
    or subcategory ilike '%body mist%'
    or subcategory ilike '%body spray%'
  );

-- Add product_type to the perfumes table so hair mists / body sprays can be
-- distinguished from EDPs, EDTs, etc.
-- Values: 'edp' | 'edt' | 'edc' | 'parfum' | 'body_spray' | 'hair_mist' | 'other'
alter table public.perfumes
  add column if not exists product_type text;

-- Backfill product_type from existing name patterns
update public.perfumes set product_type =
  case
    when name ilike '%hair mist%'      then 'hair_mist'
    when name ilike '%hair perfume%'   then 'hair_mist'
    when name ilike '%hair ritual%'    then 'hair_mist'
    when name ilike '%hair spray%'     then 'hair_mist'
    when name ilike '%body mist%'      then 'body_spray'
    when name ilike '%body spray%'     then 'body_spray'
    when name ilike '%all over body%'  then 'body_spray'
    when name ilike '%eau de parfum%'  then 'edp'
    when name ilike '% edp%'           then 'edp'
    when name ilike '%eau de toilette%' then 'edt'
    when name ilike '% edt%'            then 'edt'
    when name ilike '%eau de cologne%' then 'edc'
    when name ilike '% edc%'           then 'edc'
    when name ilike '%parfum%'         then 'edp'
    else 'other'
  end
where product_type is null;

create index if not exists perfumes_product_type_idx on public.perfumes (product_type);

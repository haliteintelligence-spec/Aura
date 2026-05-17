-- Snif House of 8 (2023) — EDT, collab with Larray, Aromatic Fougère
-- Notes sourced from Fragrantica / Wikiparfum; pyramid inferred from family profile.
-- No official top/heart/base breakdown is published; layout follows Aromatic Fougère convention.

WITH upd AS (
  UPDATE public.perfumes SET
    year             = 2023,
    description      = 'Welcome to House of 8, where secrets unravel and mischief prevails. Dark meets light in this irresistible combination of chocolate, vanilla, and sandalwood balanced by sage and iris. A cosmic scent that''s as mysterious as it is luxe.',
    top_notes        = '{"Lavender","Clary Sage"}',
    heart_notes      = '{"Heliotrope","Iris"}',
    base_notes       = '{"Chocolate","Vanilla","Sandalwood"}',
    fragrance_family = '{"Aromatic","Fougère"}',
    gender           = 'unisex',
    product_type     = 'edt',
    prices           = '[{"size":"30ml","price_min":65,"price_max":65,"currency":"USD"}]'
  WHERE lower(brand) = 'snif' AND lower(name) LIKE '%house of 8%'
  RETURNING id
)
INSERT INTO public.perfumes (id,name,brand,year,description,top_notes,heart_notes,base_notes,fragrance_family,gender,image_url,prices,product_type,created_at)
SELECT
  uuid_generate_v4(),
  'House of 8',
  'Snif',
  2023,
  'Welcome to House of 8, where secrets unravel and mischief prevails. Dark meets light in this irresistible combination of chocolate, vanilla, and sandalwood balanced by sage and iris. A cosmic scent that''s as mysterious as it is luxe.',
  '{"Lavender","Clary Sage"}',
  '{"Heliotrope","Iris"}',
  '{"Chocolate","Vanilla","Sandalwood"}',
  '{"Aromatic","Fougère"}',
  'unisex',
  null,
  '[{"size":"30ml","price_min":65,"price_max":65,"currency":"USD"}]',
  'edt',
  now()
WHERE NOT EXISTS (SELECT 1 FROM upd)
  AND NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name) LIKE '%house of 8%');

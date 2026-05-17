-- Snif: update notes + fragrance_family for all existing Snif perfumes,
-- insert missing fragrances and 7 body mists.
--
-- ALL Snif products currently have fragrance_family = '{}', so every
-- UPDATE block here sets it from the data scraped on snif.co.
-- Secret Menu products show only "fine fragrance" on-site — families
-- are inferred from their note profiles.
--
-- Strategy: WITH upd AS (UPDATE ... RETURNING id)
--           INSERT ... WHERE NOT EXISTS (upd) AND NOT EXISTS (same name)
-- Updates the row when it exists, inserts only when it doesn't.

-- ─────────────────────────────────────────────────────────────────────────────
-- MAIN-LINE FRAGRANCES
-- ─────────────────────────────────────────────────────────────────────────────

-- 2%  (family from site: "woody, gourmand")
WITH upd AS (
  UPDATE public.perfumes SET
    top_notes        = '{"Milk Carton Accord"}',
    heart_notes      = '{"Fresh Dairy Accord","Lactones"}',
    base_notes       = '{"Vanilla","Praline","Caramel"}',
    fragrance_family = '{"Woody","Gourmand"}',
    description      = 'A milk scent that keeps your glass half full.',
    image_url        = 'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/2__30ml_Image_01.jpg?v=1774536026',
    prices           = '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
    product_type     = 'other'
  WHERE lower(brand) = 'snif' AND (name = '2%' OR lower(name) ILIKE '2% %')
  RETURNING id
)
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'2%','Snif',
  'A milk scent that keeps your glass half full.',
  '{"Milk Carton Accord"}','{"Fresh Dairy Accord","Lactones"}','{"Vanilla","Praline","Caramel"}',
  '{"Woody","Gourmand"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/2__30ml_Image_01.jpg?v=1774536026',
  '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
  'other', now()
WHERE NOT EXISTS (SELECT 1 FROM upd)
  AND NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND (name='2%' OR lower(name) ILIKE '2% %'));

-- Only Sunshine  (family: "fruity, floral") — covers TTS variant too
WITH upd AS (
  UPDATE public.perfumes SET
    top_notes        = '{"Mango","Papaya","Sea Breeze"}',
    heart_notes      = '{"Orange Blossom"}',
    base_notes       = '{"Amber","Musk"}',
    fragrance_family = '{"Fruity","Floral"}',
    description      = 'A tropical scent with a warm ocean breeze.',
    image_url        = 'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Only_Sunshine_Gallery_Image_01.jpg?v=1772051916',
    prices           = '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
    product_type     = 'other'
  WHERE lower(brand) = 'snif' AND lower(name) ILIKE '%only sunshine%'
  RETURNING id
)
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'Only Sunshine','Snif',
  'A tropical scent with a warm ocean breeze.',
  '{"Mango","Papaya","Sea Breeze"}','{"Orange Blossom"}','{"Amber","Musk"}',
  '{"Fruity","Floral"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Only_Sunshine_Gallery_Image_01.jpg?v=1772051916',
  '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
  'other', now()
WHERE NOT EXISTS (SELECT 1 FROM upd)
  AND NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name) ILIKE '%only sunshine%');

-- Coco Shimmy  (family: "ambery, fruity")
WITH upd AS (
  UPDATE public.perfumes SET
    top_notes        = '{"Coconut","Pineapple"}',
    heart_notes      = '{"Sunscreen","Surf Wax"}',
    base_notes       = '{"Sandalwood","Tonka Bean"}',
    fragrance_family = '{"Ambery","Fruity"}',
    description      = 'A coconut spritz with a sun-kissed twist.',
    image_url        = 'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Snif_Fragrance_Coco_Shimmy_30ml_Product_Thumbnail.jpg?v=1713984344',
    prices           = '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
    product_type     = 'other'
  WHERE lower(brand) = 'snif' AND lower(name) ILIKE '%coco shimmy%'
  RETURNING id
)
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'Coco Shimmy','Snif',
  'A coconut spritz with a sun-kissed twist.',
  '{"Coconut","Pineapple"}','{"Sunscreen","Surf Wax"}','{"Sandalwood","Tonka Bean"}',
  '{"Ambery","Fruity"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Snif_Fragrance_Coco_Shimmy_30ml_Product_Thumbnail.jpg?v=1713984344',
  '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
  'other', now()
WHERE NOT EXISTS (SELECT 1 FROM upd)
  AND NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name) ILIKE '%coco shimmy%');

-- Me  (family: "woody, musky, fruity")
WITH upd AS (
  UPDATE public.perfumes SET
    top_notes        = '{"Peach Skin","Plum"}',
    heart_notes      = '{"Orris"}',
    base_notes       = '{"White Moss","Musks","Sandalwood"}',
    fragrance_family = '{"Woody","Musky","Fruity"}',
    description      = 'A shape-shifting skin scent that''s soft yet strong.',
    image_url        = 'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Snif_Fragrance_Me_30ml_Thumbnail.jpg',
    prices           = '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
    product_type     = 'other'
  WHERE lower(brand) = 'snif' AND lower(name) = 'me'
  RETURNING id
)
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'Me','Snif',
  'A shape-shifting skin scent that''s soft yet strong.',
  '{"Peach Skin","Plum"}','{"Orris"}','{"White Moss","Musks","Sandalwood"}',
  '{"Woody","Musky","Fruity"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Snif_Fragrance_Me_30ml_Thumbnail.jpg',
  '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
  'other', now()
WHERE NOT EXISTS (SELECT 1 FROM upd)
  AND NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name)='me');

-- Sweet Ash  (family: "woody, ambery, aromatic")
WITH upd AS (
  UPDATE public.perfumes SET
    top_notes        = '{"Juniper","Bergamot"}',
    heart_notes      = '{"Fir Balsam","Tonka Bean","Vanilla Bean"}',
    base_notes       = '{"White Moss"}',
    fragrance_family = '{"Woody","Ambery","Aromatic"}',
    description      = 'Down-to-earth, addictive, with compliments guaranteed.',
    image_url        = 'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Snif_SA_Relaunch_Product_Image_30ml_1_53cee47b-0940-4d7b-8ae0-6e81e6aebe47.jpg?v=1725482766',
    prices           = '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
    product_type     = 'other'
  WHERE lower(brand) = 'snif' AND lower(name) ILIKE '%sweet ash%'
  RETURNING id
)
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'Sweet Ash','Snif',
  'Down-to-earth, addictive, with compliments guaranteed.',
  '{"Juniper","Bergamot"}','{"Fir Balsam","Tonka Bean","Vanilla Bean"}','{"White Moss"}',
  '{"Woody","Ambery","Aromatic"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Snif_SA_Relaunch_Product_Image_30ml_1_53cee47b-0940-4d7b-8ae0-6e81e6aebe47.jpg?v=1725482766',
  '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
  'other', now()
WHERE NOT EXISTS (SELECT 1 FROM upd)
  AND NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name) ILIKE '%sweet ash%');

-- Rose Era  (family: "fruity, floral")
WITH upd AS (
  UPDATE public.perfumes SET
    top_notes        = '{"Ambrette Seeds","Strawberry","Saffron"}',
    heart_notes      = '{"Rose","Clean Laundry Accord"}',
    base_notes       = '{"White Moss"}',
    fragrance_family = '{"Fruity","Floral"}',
    description      = 'A dewy rose and strawberry scent made for your floral fixation.',
    image_url        = 'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Snif_Rose_Era_Product_Image_30ml_Thumbnail.jpg',
    prices           = '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
    product_type     = 'other'
  WHERE lower(brand) = 'snif' AND lower(name) ILIKE '%rose era%'
  RETURNING id
)
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'Rose Era','Snif',
  'A dewy rose and strawberry scent made for your floral fixation.',
  '{"Ambrette Seeds","Strawberry","Saffron"}','{"Rose","Clean Laundry Accord"}','{"White Moss"}',
  '{"Fruity","Floral"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Snif_Rose_Era_Product_Image_30ml_Thumbnail.jpg',
  '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
  'other', now()
WHERE NOT EXISTS (SELECT 1 FROM upd)
  AND NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name) ILIKE '%rose era%');

-- Vanilla Vice  (family: "woody, ambery, vanilla")
WITH upd AS (
  UPDATE public.perfumes SET
    top_notes        = '{"Ice Cream Accord"}',
    heart_notes      = '{"Vanilla Bean","Jasmine Sambac"}',
    base_notes       = '{"Amberwood","Musk","Orcanox"}',
    fragrance_family = '{"Woody","Ambery","Vanilla"}',
    description      = 'A vanilla scent so addictive, everyone will want a lick.',
    image_url        = 'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Snif_Fragrance_Vanilla_Vice_30ml_Thumbnail.jpg',
    prices           = '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
    product_type     = 'other'
  WHERE lower(brand) = 'snif' AND lower(name) ILIKE '%vanilla vice%'
  RETURNING id
)
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'Vanilla Vice','Snif',
  'A vanilla scent so addictive, everyone will want a lick.',
  '{"Ice Cream Accord"}','{"Vanilla Bean","Jasmine Sambac"}','{"Amberwood","Musk","Orcanox"}',
  '{"Woody","Ambery","Vanilla"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Snif_Fragrance_Vanilla_Vice_30ml_Thumbnail.jpg',
  '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
  'other', now()
WHERE NOT EXISTS (SELECT 1 FROM upd)
  AND NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name) ILIKE '%vanilla vice%');

-- Hot Cakes  (family: "gourmand, musky, fruity")
WITH upd AS (
  UPDATE public.perfumes SET
    top_notes        = '{"Buttermilk","Melted Butter"}',
    heart_notes      = '{"Pancake Accord","Maple Syrup"}',
    base_notes       = '{"Berry Compote","Sugared Musk"}',
    fragrance_family = '{"Gourmand","Musky","Fruity"}',
    description      = 'A syrup-soaked pancake scent that stacks up.',
    image_url        = 'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Hot_Cakes_Product_30ml_1x1_01.jpg',
    prices           = '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
    product_type     = 'other'
  WHERE lower(brand) = 'snif' AND lower(name) ILIKE '%hot cakes%'
  RETURNING id
)
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'Hot Cakes','Snif',
  'A syrup-soaked pancake scent that stacks up.',
  '{"Buttermilk","Melted Butter"}','{"Pancake Accord","Maple Syrup"}','{"Berry Compote","Sugared Musk"}',
  '{"Gourmand","Musky","Fruity"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Hot_Cakes_Product_30ml_1x1_01.jpg',
  '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
  'other', now()
WHERE NOT EXISTS (SELECT 1 FROM upd)
  AND NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name) ILIKE '%hot cakes%');

-- Gentle Reminder  (family: "floral, gourmand") — covers TTS variant
WITH upd AS (
  UPDATE public.perfumes SET
    top_notes        = '{"Date Sugar","Milk Froth","Black Tea"}',
    heart_notes      = '{"Purple Ube","Lavender"}',
    base_notes       = '{"Palo Santo"}',
    fragrance_family = '{"Floral","Gourmand"}',
    description      = 'A milky lavender and ube scent made for your soft side.',
    image_url        = 'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Gentle_Reminder_Product_Image_01_b7632beb-c7a6-4f42-bc20-b87caade5151.jpg',
    prices           = '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
    product_type     = 'other'
  WHERE lower(brand) = 'snif' AND lower(name) ILIKE '%gentle reminder%'
  RETURNING id
)
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'Gentle Reminder','Snif',
  'A milky lavender and ube scent made for your soft side.',
  '{"Date Sugar","Milk Froth","Black Tea"}','{"Purple Ube","Lavender"}','{"Palo Santo"}',
  '{"Floral","Gourmand"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Gentle_Reminder_Product_Image_01_b7632beb-c7a6-4f42-bc20-b87caade5151.jpg',
  '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
  'other', now()
WHERE NOT EXISTS (SELECT 1 FROM upd)
  AND NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name) ILIKE '%gentle reminder%');

-- Heal the Way  (family: "ambery, gourmand") — covers TTS variant
WITH upd AS (
  UPDATE public.perfumes SET
    top_notes        = '{"Pistachio Cream"}',
    heart_notes      = '{"Davana","Palo Santo"}',
    base_notes       = '{"Vanilla Absolute","Musk","Amber"}',
    fragrance_family = '{"Ambery","Gourmand"}',
    description      = 'A comforting pistachio and palo santo scent that pairs well with your daily affirmations.',
    image_url        = 'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Snif_AlexElle_HTW_Product_Image_Thumbnail.jpg',
    prices           = '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
    product_type     = 'other'
  WHERE lower(brand) = 'snif' AND lower(name) ILIKE '%heal the way%'
  RETURNING id
)
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'Heal the Way','Snif',
  'A comforting pistachio and palo santo scent that pairs well with your daily affirmations.',
  '{"Pistachio Cream"}','{"Davana","Palo Santo"}','{"Vanilla Absolute","Musk","Amber"}',
  '{"Ambery","Gourmand"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Snif_AlexElle_HTW_Product_Image_Thumbnail.jpg',
  '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
  'other', now()
WHERE NOT EXISTS (SELECT 1 FROM upd)
  AND NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name) ILIKE '%heal the way%');

-- ─────────────────────────────────────────────────────────────────────────────
-- SECRET MENU FRAGRANCES
-- Site shows only "fine fragrance" — families inferred from note profiles.
-- ─────────────────────────────────────────────────────────────────────────────

-- Crumb Couture  (inferred: gourmand)
WITH upd AS (
  UPDATE public.perfumes SET
    top_notes        = '{"Croissant Accord","Wild Berry Jam"}',
    heart_notes      = '{"Blackcurrant","Toasted Vanilla"}',
    base_notes       = '{"Tonka Bean","Sandalwood"}',
    fragrance_family = '{"Gourmand"}',
    description      = 'A buttery, croissant scent that won''t flake on you.',
    image_url        = 'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/SM_Crumb_Couture_Product_Image_New_2.png?v=1769922237',
    prices           = '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
    product_type     = 'other'
  WHERE lower(brand) = 'snif' AND lower(name) = 'crumb couture'
  RETURNING id
)
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'Crumb Couture','Snif',
  'A buttery, croissant scent that won''t flake on you.',
  '{"Croissant Accord","Wild Berry Jam"}','{"Blackcurrant","Toasted Vanilla"}','{"Tonka Bean","Sandalwood"}',
  '{"Gourmand"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/SM_Crumb_Couture_Product_Image_New_2.png?v=1769922237',
  '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
  'other', now()
WHERE NOT EXISTS (SELECT 1 FROM upd)
  AND NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name)='crumb couture');

-- Crumb Couture Almond  (inferred: gourmand) — covers TTS variant
WITH upd AS (
  UPDATE public.perfumes SET
    top_notes        = '{"Almond Cream","Croissant Accord"}',
    heart_notes      = '{"Powdered Sugar","Vanilla"}',
    base_notes       = '{"Buttery Musks","Creamy Sandalwood"}',
    fragrance_family = '{"Gourmand"}',
    description      = 'Same crumbs, new couture — a twice-toasted, sweet, and almond twist on the classic croissant scent.',
    image_url        = 'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Snif_SM_CCA_Thumbnail.jpg',
    prices           = '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
    product_type     = 'other'
  WHERE lower(brand) = 'snif' AND lower(name) ILIKE '%crumb couture almond%'
  RETURNING id
)
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'Crumb Couture Almond','Snif',
  'Same crumbs, new couture — a twice-toasted, sweet, and almond twist on the classic croissant scent.',
  '{"Almond Cream","Croissant Accord"}','{"Powdered Sugar","Vanilla"}','{"Buttery Musks","Creamy Sandalwood"}',
  '{"Gourmand"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Snif_SM_CCA_Thumbnail.jpg',
  '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
  'other', now()
WHERE NOT EXISTS (SELECT 1 FROM upd)
  AND NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name) ILIKE '%crumb couture almond%');

-- Naughty Nonna  (inferred: gourmand, spicy)
WITH upd AS (
  UPDATE public.perfumes SET
    top_notes        = '{"Candied Ginger","Orange"}',
    heart_notes      = '{"Prune","Rum","Walnut"}',
    base_notes       = '{"Vanilla Glaze"}',
    fragrance_family = '{"Gourmand","Spicy"}',
    description      = 'A fruitcake scent so good, you won''t want to re-gift it.',
    image_url        = 'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Snif_SM_NN_Product_Image_30ml_2.png?v=1769922498',
    prices           = '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
    product_type     = 'other'
  WHERE lower(brand) = 'snif' AND lower(name) ILIKE '%naughty nonna%'
  RETURNING id
)
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'Naughty Nonna','Snif',
  'A fruitcake scent so good, you won''t want to re-gift it.',
  '{"Candied Ginger","Orange"}','{"Prune","Rum","Walnut"}','{"Vanilla Glaze"}',
  '{"Gourmand","Spicy"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Snif_SM_NN_Product_Image_30ml_2.png?v=1769922498',
  '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
  'other', now()
WHERE NOT EXISTS (SELECT 1 FROM upd)
  AND NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name) ILIKE '%naughty nonna%');

-- Dead Dinosaur  (inferred: woody, aromatic)
WITH upd AS (
  UPDATE public.perfumes SET
    top_notes        = '{"Pink Pepper","Ginger"}',
    heart_notes      = '{"Gasoline Accord","Magnolia Flower","Orris","Davana"}',
    base_notes       = '{"Cedarwood","Peru Balsam","Amber Woods"}',
    fragrance_family = '{"Woody","Aromatic"}',
    description      = 'Not a new car scent, but your first car scent. An ode to the addictive smell of gasoline, garage hangs, and simpler times.',
    image_url        = 'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Snif_SM_DD_Product_2.jpg?v=1701421960',
    prices           = '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
    product_type     = 'other'
  WHERE lower(brand) = 'snif' AND lower(name) ILIKE '%dead dinosaur%'
  RETURNING id
)
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'Dead Dinosaur','Snif',
  'Not a new car scent, but your first car scent. An ode to the addictive smell of gasoline, garage hangs, and simpler times.',
  '{"Pink Pepper","Ginger"}','{"Gasoline Accord","Magnolia Flower","Orris","Davana"}','{"Cedarwood","Peru Balsam","Amber Woods"}',
  '{"Woody","Aromatic"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Snif_SM_DD_Product_2.jpg?v=1701421960',
  '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
  'other', now()
WHERE NOT EXISTS (SELECT 1 FROM upd)
  AND NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name) ILIKE '%dead dinosaur%');

-- Soda Snob  (inferred: gourmand, citrus)
WITH upd AS (
  UPDATE public.perfumes SET
    top_notes        = '{"Fizzy Lime","Cinnamon"}',
    heart_notes      = '{"Secret Cola Accord","Jasmine"}',
    base_notes       = '{"Caramel","Vanilla"}',
    fragrance_family = '{"Gourmand","Citrus"}',
    description      = 'A crisp cola scent with a euphoric pop.',
    image_url        = 'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/SM_Soda_30ml_Product_Images-7.png?v=1769921953',
    prices           = '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
    product_type     = 'other'
  WHERE lower(brand) = 'snif' AND lower(name) ILIKE '%soda snob%'
  RETURNING id
)
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'Soda Snob','Snif',
  'A crisp cola scent with a euphoric pop.',
  '{"Fizzy Lime","Cinnamon"}','{"Secret Cola Accord","Jasmine"}','{"Caramel","Vanilla"}',
  '{"Gourmand","Citrus"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/SM_Soda_30ml_Product_Images-7.png?v=1769921953',
  '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
  'other', now()
WHERE NOT EXISTS (SELECT 1 FROM upd)
  AND NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name) ILIKE '%soda snob%');

-- Slice Society  (inferred: gourmand, green)
WITH upd AS (
  UPDATE public.perfumes SET
    top_notes        = '{"Black Currant","Basil"}',
    heart_notes      = '{"Tomato Sauce Accord","Iris"}',
    base_notes       = '{"Crust Accord","Sandalwood"}',
    fragrance_family = '{"Gourmand","Green"}',
    description      = 'An oven-fresh scent that will make your mouth water.',
    image_url        = 'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/SM_Slice_30ml_Product_Images-6.png?v=1713429845',
    prices           = '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
    product_type     = 'other'
  WHERE lower(brand) = 'snif' AND lower(name) ILIKE '%slice society%'
  RETURNING id
)
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'Slice Society','Snif',
  'An oven-fresh scent that will make your mouth water.',
  '{"Black Currant","Basil"}','{"Tomato Sauce Accord","Iris"}','{"Crust Accord","Sandalwood"}',
  '{"Gourmand","Green"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/SM_Slice_30ml_Product_Images-6.png?v=1713429845',
  '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
  'other', now()
WHERE NOT EXISTS (SELECT 1 FROM upd)
  AND NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name) ILIKE '%slice society%');

-- Swede Tooth  (inferred: fruity, sweet)
WITH upd AS (
  UPDATE public.perfumes SET
    top_notes        = '{"Watermelon","Raspberry"}',
    heart_notes      = '{"Candy Sugar","Violet"}',
    base_notes       = '{"Cedarwood","Musk"}',
    fragrance_family = '{"Fruity","Sweet"}',
    description      = 'A juicy watermelon scent made for your sweet tooth.',
    image_url        = 'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Snif_Fragrance_SM_Swede_Tooth__Ulta_Badge.png?v=1769922386',
    prices           = '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
    product_type     = 'other'
  WHERE lower(brand) = 'snif' AND lower(name) ILIKE '%swede tooth%'
  RETURNING id
)
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'Swede Tooth','Snif',
  'A juicy watermelon scent made for your sweet tooth.',
  '{"Watermelon","Raspberry"}','{"Candy Sugar","Violet"}','{"Cedarwood","Musk"}',
  '{"Fruity","Sweet"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Snif_Fragrance_SM_Swede_Tooth__Ulta_Badge.png?v=1769922386',
  '[{"size":"30ml","price_min":68,"price_max":68,"currency":"USD"},{"size":"10ml","price_min":26,"price_max":26,"currency":"USD"}]',
  'other', now()
WHERE NOT EXISTS (SELECT 1 FROM upd)
  AND NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name) ILIKE '%swede tooth%');

-- ─────────────────────────────────────────────────────────────────────────────
-- BODY MISTS  (product_type = 'body_spray', families from snif.co product pages)
-- ─────────────────────────────────────────────────────────────────────────────

-- Crunch Time Body Mist  (family: "gourmand")
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'Crunch Time Body Mist','Snif',
  'With a cinnamon-coated blend of melted butter, cereal accord, and brown sugar, you''ll want another spray with every swirled spoonful.',
  '{"Cinnamilk","Melted Butter"}','{"Cinnamon Sugar","Cereal Accord"}','{"Brown Sugar","Musk"}',
  '{"Gourmand"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Crunch_Time_2.5oz_Image_01.jpg?v=1774465640',
  '[{"size":"2.5 oz","price_min":24,"price_max":24,"currency":"USD"},{"size":"8 oz","price_min":38,"price_max":38,"currency":"USD"}]',
  'body_spray', now()
WHERE NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name) ILIKE '%crunch time%');

-- Frooty Call Body Mist  (family: "citrus, gourmand, fruity")
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'Frooty Call Body Mist','Snif',
  'A vibrant strawberry citrus mist that''s a technicolor treat.',
  '{"Lemon Sugar","Strawberry","Lime"}','{"Sheer Florals","Cereal Accord"}','{"Sandalwood"}',
  '{"Citrus","Gourmand","Fruity"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Frooty_Call_2.5oz_Image_01_2c26652d-3a32-4bd8-a522-213a8e255de5.jpg?v=1774534915',
  '[{"size":"2.5 oz","price_min":24,"price_max":24,"currency":"USD"},{"size":"8 oz","price_min":38,"price_max":38,"currency":"USD"}]',
  'body_spray', now()
WHERE NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name) ILIKE '%frooty call%');

-- Lucky Streak Body Mist  (family: "gourmand, vanilla")
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'Lucky Streak Body Mist','Snif',
  'With a mix of marshmallow, heliotrope, cereal accord, corn starch, musk, and air-puffed vanilla, you''ll see rainbows and stars every time you spray it.',
  '{"Marshmallow","Heliotrope"}','{"Cereal Accord","Corn Starch"}','{"Air-Puffed Vanilla","Musk"}',
  '{"Gourmand","Vanilla"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Lucky_Streak_2.5oz_Image_01.jpg?v=1774464681',
  '[{"size":"2.5 oz","price_min":24,"price_max":24,"currency":"USD"},{"size":"8 oz","price_min":38,"price_max":38,"currency":"USD"}]',
  'body_spray', now()
WHERE NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name) ILIKE '%lucky streak%');

-- Spray Tan Body Mist  (family: "fruity, woody, solar")
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'Spray Tan Body Mist','Snif',
  'Drenched in coconut-soaked gardenia (monoi), carrot, banana flower, tiger lily, and Tahitian vanilla — a tanning oil-inspired scent that smells like you spent a week at the beach.',
  '{"Monoi","Carrot","Tiger Lily"}','{"Banana Flower","Tanning Oil Accord"}','{"Tahitian Vanilla"}',
  '{"Fruity","Woody","Solar"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/Spray_Tan_Product_Imagery_01_06e83ad1-4ff0-4b25-ba03-5627540ba07d.jpg?v=1749670860',
  '[{"size":"2.5 oz","price_min":24,"price_max":24,"currency":"USD"},{"size":"8 oz","price_min":38,"price_max":38,"currency":"USD"}]',
  'body_spray', now()
WHERE NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name) ILIKE '%spray tan%');

-- Extra Whip Body Mist  (family: "ambery, gourmand, musky")
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'Extra Whip Body Mist','Snif',
  'We whisked icing sugar, vanilla, and cold aldehydes with sandalwood and musk to create a nostalgic scent that''s cooler than whipped cream straight from the can.',
  '{"Icing Sugar","Cold Aldehydes"}','{"Whipped Cream"}','{"Milky Sandalwood","Vanilla","Fluffy Musk"}',
  '{"Ambery","Gourmand","Musky"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/2.5oz_EW_Body_Mist_Product_Image_1x1_01.jpg?v=1741016034',
  '[{"size":"2.5 oz","price_min":24,"price_max":24,"currency":"USD"},{"size":"8 oz","price_min":38,"price_max":38,"currency":"USD"}]',
  'body_spray', now()
WHERE NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name) ILIKE '%extra whip%');

-- Berry Styles Body Mist  (family: "fruity, gourmand, woody")
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'Berry Styles Body Mist','Snif',
  'A blueberry scent that hits all the right notes.',
  '{"Blueberry","Lime","Raspberry"}','{"Blue Freesia"}','{"Vanilla","Creamy Woods"}',
  '{"Fruity","Gourmand","Woody"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/2oz_Berry_Styles_Product_Imagery_1x1_01.jpg?v=1741277799',
  '[{"size":"2.5 oz","price_min":24,"price_max":24,"currency":"USD"},{"size":"8 oz","price_min":38,"price_max":38,"currency":"USD"}]',
  'body_spray', now()
WHERE NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name) ILIKE '%berry styles%');

-- Hazel Split Body Mist  (family: "ambery, gourmand, fruity")
INSERT INTO public.perfumes (id,name,brand,description,top_notes,heart_notes,base_notes,fragrance_family,image_url,prices,product_type,created_at)
SELECT uuid_generate_v4(),'Hazel Split Body Mist','Snif',
  'We blended milky cocoa with creamy hazelnut, slices of banana, and a swirl of coconut until it was more tempting than a midnight spoonful.',
  '{"Cocoa","Hazelnut Spread Accord"}','{"Creamy Banana","Coconut"}','{"Amberwood","Musk"}',
  '{"Ambery","Gourmand","Fruity"}',
  'https://cdn.shopify.com/s/files/1/0417/0026/2045/files/2.5oz_Hazel_Split_Product_Image_01.jpg?v=1741279673',
  '[{"size":"2.5 oz","price_min":24,"price_max":24,"currency":"USD"},{"size":"8 oz","price_min":38,"price_max":38,"currency":"USD"}]',
  'body_spray', now()
WHERE NOT EXISTS (SELECT 1 FROM public.perfumes WHERE lower(brand)='snif' AND lower(name) ILIKE '%hazel split%');

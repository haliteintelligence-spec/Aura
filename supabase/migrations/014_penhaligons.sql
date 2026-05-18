-- Penhaligon's fragrances: 41 products scraped from penhaligons.com/us/en
-- Notes sourced from product page "Key Notes" sections.
-- Products without a published pyramid have all key notes placed in heart_notes.
-- Descriptions are verbatim from the brand site.

WITH data(name, description, top_notes, heart_notes, base_notes, fragrance_family, gender, image_url, prices, product_type) AS (
  VALUES
    (
      'Halfeti'::text,
      'So this is love. An intoxicating, mysterious fragrance: vigorous grapefruit, oud, Levantine spice and rose tangle in the moonlight. But what''s that upon the riverbank? Could it be the fabled black rose?'::text,
      ARRAY[]::text[],
      ARRAY['Oud','Bergamot','Rose'],
      ARRAY[]::text[],
      ARRAY['Oriental','Spicy'],
      'unisex'::text,
      'https://dynamic-assets.penhaligons.com/is/image/puig/HALFETI_EDP_100ML_Product_Web_PDP?$Transparent-png$&version=61588c27aa52c2497ba79f53dcc5f0c160c763aa'::text,
      '[{"size":"100ml","price_min":330,"price_max":330,"currency":"USD"}]'::jsonb,
      'edp'::text
    ),
    (
      'Alula',
      'Across sweeping saffron deserts, an oasis of plum and patchouli perfumes the Incense Road. Vanilla winds whisper across the horizon. Plum. Patchouli. Palms reach skyward, taller than incense, next to a monolith of spice and tobacco. A sweeping desert of saffron, born of sand and drenched in sky.',
      ARRAY[]::text[],
      ARRAY['Plum','Incense','Vanilla'],
      ARRAY[]::text[],
      ARRAY['Amber','Woody'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/AIUIa_EDP_100ML_Product_Web_PDP1?$Transparent-png$&version=7f5bbcae71e9dac78122d14f7a4446fb084f42e3',
      '[{"size":"100ml","price_min":330,"price_max":330,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'The Coveted Duchess Rose',
      'A sweet-scented Rose, ready for the picking. Mandarin and musk in miniature, you coy vixen. Rose''s coy eau de parfum conceals something more sensual — a hint of musky wood.',
      ARRAY[]::text[],
      ARRAY['Mandarin','Rose Centifolia','Vanilla'],
      ARRAY[]::text[],
      ARRAY['Floral'],
      'women',
      'https://dynamic-assets.penhaligons.com/is/image/puig/PORTRAITS%20DUCHESS%20ROSE%20EDP%2075ML_Product_Web_PDP?$Transparent-png$&version=761fd0b1fea316a0679ec5f6824d912c7be9df78',
      '[{"size":"75ml","price_min":345,"price_max":345,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'The Tragedy of Lord George',
      'Rich, noble, deceptive. Like our patriarch, this woody perfume has secrets. Noble patriarch, paragon of masculine elegance, Lord George welcomes with a scent of shaving soap and warming rum. But what secrets hide behind tradition?',
      ARRAY[]::text[],
      ARRAY['Ambrox','Rum','Tonka Bean'],
      ARRAY[]::text[],
      ARRAY['Woody'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/65173406%20Lord%20George%2075ml%20PdP?$Transparent-png$&version=dd168b32728af182c3b235b3e401089bc7065783',
      '[{"size":"75ml","price_min":350,"price_max":350,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'Luna',
      'The Moon Goddess'' bath is as soothing as it is seductive, much like her eau de toilette. It shines with orange, jasmine, soft rose and fir balsam. Relax. Sink in. Surrender has never felt so sweet.',
      ARRAY[]::text[],
      ARRAY['Jasmine','Fir Balsam','Bergamot'],
      ARRAY[]::text[],
      ARRAY['Floral','Fresh'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/Luna_new_PRODUCT_Web_PDP?$Transparent-png$&version=3cc6b317e2ddc23b0d77ddb8907c1a2d5cef4348',
      '[{"size":"100ml","price_min":260,"price_max":260,"currency":"USD"}]'::jsonb,
      'edt'
    ),
    (
      'The Cut',
      'A fashionable fougère tailored to precision. First, a stitch of mint is threaded to fir balsam, expertly sewn with cypress and cedar. Clary sage swaggers down Savile Row to a round of lavender applause.',
      ARRAY['Mint'],
      ARRAY['Cypress'],
      ARRAY['Fir Balsam'],
      ARRAY['Fougère'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/The_Cut_100ml_Product_Web_PDP?$Transparent-png$&version=49b0d3432e1a224e67239bcddb0200f887cce8d8',
      '[{"size":"100ml","price_min":260,"price_max":260,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'Juniper Sling',
      'This eau de toilette is a gin lover''s delight. Better make it a double. A juniper burst of freshness. Teasing angelica and black pepper. Warm spice and warm hearts.',
      ARRAY[]::text[],
      ARRAY['Juniper Berry','Black Pepper','Vetiver'],
      ARRAY[]::text[],
      ARRAY['Fresh'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/JUNIPER%20SLING%20EDT%20100ML_Product_Web_PDP1?$Transparent-png$&version=b8cb01bc36f39fe365b60ad5db7eb96555ce63f8',
      '[{"size":"100ml","price_min":260,"price_max":260,"currency":"USD"}]'::jsonb,
      'edt'
    ),
    (
      'Bluebell',
      'A woodland wander amidst a fragrant carpet of bluebells. Pure bliss. If you go down to the woods today... a fragrant carpet of bluebells awaits. Breathe deep. Citrus, hyacinth, clove. An eau de toilette reminiscent of childhood escapades in the fresh, dewy spring.',
      ARRAY[]::text[],
      ARRAY['Citrus Accord','Hyacinth','Clove'],
      ARRAY[]::text[],
      ARRAY['Floral'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/BLUEBELL%20100ML_Product_Web_PDP?$Transparent-png$&version=e579159360c9967af3ebbffb33c3d2bbb3eadd92',
      '[{"size":"100ml","price_min":210,"price_max":210,"currency":"USD"}]'::jsonb,
      'edt'
    ),
    (
      'The Blazing Mister Sam',
      'Hot and cold spices mingle over dry patchouli and creamy cedar. An American abroad with cocky confidence — Sam''s charms are irresistible.',
      ARRAY['Black Pepper'],
      ARRAY['Cardamom'],
      ARRAY['Cedarwood','Patchouli'],
      ARRAY['Spicy','Woody'],
      'men',
      'https://dynamic-assets.penhaligons.com/is/image/puig/THE_BLAZING_MR_SAM_75ML_EDP_Product_Web_PDP?$Transparent-png$&version=1065d959d1c987187380e98d279decd5a34cc53d',
      '[{"size":"75ml","price_min":350,"price_max":350,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'Empressa',
      'Radiant with peach, vanilla and blood orange, the Empressa''s scent bewitches. Her eau de parfum is laced with peach, vanilla and shimmering blood orange, as bright and stirring as the dawn. Her smile? Warm, lustrous, and unforgettable.',
      ARRAY['Blood Orange','Bergamot','Mandarin'],
      ARRAY['Jasmine','Rose','Heliotrope'],
      ARRAY['Vanilla','Sandalwood','Musk'],
      ARRAY['Floral','Spicy'],
      'women',
      'https://dynamic-assets.penhaligons.com/is/image/puig/EMPRESSA_EDP_100ML_Product_Web_PDP?$Transparent-png$&version=c927e51ae5d0b305a9459072b6d5998c8b4a60a1',
      '[{"size":"100ml","price_min":330,"price_max":330,"currency":"USD"},{"size":"30ml","price_min":155,"price_max":155,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'Cairo',
      'The sun rising over Cairo brings warm saffron spice. Soon, all is life. Damascena rose and labdanum bloom above sensual patchouli. This city''s eau de parfum is ancient, but born anew each day.',
      ARRAY[]::text[],
      ARRAY['Vanilla','Rose','Saffron'],
      ARRAY[]::text[],
      ARRAY['Oriental'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/CAIRO_EDP_100ML_Product_Web_PDP1?$Transparent-png$&version=a482ab5045ca995d3afc11fab663e7e6163306ef',
      '[{"size":"100ml","price_min":330,"price_max":330,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'Lothair',
      'As novel as a foreign shore, as familiar as a cup of tea. Named after one of the last clippers, the Lothair''s hold is stuffed with the fragrant spoils of adventure: juniper, fig milk and ambergris.',
      ARRAY['Fig Leaf','Grapefruit','Juniper'],
      ARRAY['Black Tea','Fig Milk','Magnolia'],
      ARRAY['Ambergris','Cedar','Wenge'],
      ARRAY['Fresh','Woody'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/LOTHAIR%20EDT%20100ML%20SIGNATURE%20REPACK_Product_Web_PDP?$Transparent-png$&version=715f5808f101fc58564d7f95d990f6535fe07330',
      '[{"size":"100ml","price_min":260,"price_max":260,"currency":"USD"}]'::jsonb,
      'edt'
    ),
    (
      'Lily of the Valley',
      'A timeless eau de toilette, as fresh and optimistic as the morning dew. Lacey leaves. Dappled light. Green, clean, wholesome. Grounded by notes of bergamot and sandalwood.',
      ARRAY[]::text[],
      ARRAY['Bergamot','Lily of the Valley','Sandalwood'],
      ARRAY[]::text[],
      ARRAY['Floral'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/LILY%20OF%20THE%20VALLEY%20EDT%20100%20ML%20CORE_Product_Web_PDP?$Transparent-png$&version=2c4787b298fdd1345b6f4ff8bb5e2d51db6762ca',
      '[{"size":"100ml","price_min":210,"price_max":210,"currency":"USD"}]'::jsonb,
      'edt'
    ),
    (
      'Quercus',
      'A cologne of some sophistication, named for the iconic English oak. Basil and lemon as fresh as a mountain stream, sweet jasmine, and a woody, mossy depth that brings one happily back to earth.',
      ARRAY['Mandarin','Basil','Lemon'],
      ARRAY['Lily of the Valley','Jasmine','Cardamom'],
      ARRAY['Oak Moss','Patchouli','Amber'],
      ARRAY['Fresh','Woody'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/QUERCUS%20EDC%20100ML_Product_Web_PDP?$Transparent-png$&version=c3c347df4d404748b177789a5531cbb9e4fbb939',
      '[{"size":"100ml","price_min":210,"price_max":210,"currency":"USD"}]'::jsonb,
      'edc'
    ),
    (
      'Changing Constance',
      'Cool cardamom, hot pimento, salted caramel — a scent with no regard for rules. Constance is what one might call A Very Modern Woman. She has no regard for custom, and does exactly as she likes. Her contrary perfume breaks every rule.',
      ARRAY[]::text[],
      ARRAY['Cardamom','Salted Butter Caramel','Tobacco'],
      ARRAY[]::text[],
      ARRAY['Oriental','Spicy'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/CHANGING%20CONSTANCE%2075ML%20EDP_Product_Web_PDP?$Transparent-png$&version=a2015be4c5550e3499e58710409eb2d703e3fbbe',
      '[{"size":"75ml","price_min":350,"price_max":350,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'The Omniscient Mr Thompson',
      'A fragrance of a few, well-chosen words. Strong but subtle wood, vanilla and sesame milk. Serving smoky, rum-like and leather hints calmed by vanilla and sesame milk, Mr Thompson is reassuring at every turn. As for what the butler saw… well, he never forgets, but is ever discrete.',
      ARRAY[]::text[],
      ARRAY['Pink Pepper','Orris','Sesame Seeds'],
      ARRAY[]::text[],
      ARRAY['Floral','Ambery'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/Portraits_Mr_Thompson_Product_Web_PDP?$Transparent-png$&version=803271fa69d53c8341f565239dd713ff80954112',
      '[{"size":"75ml","price_min":350,"price_max":350,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'Fortuitous Finley',
      'A fortuitous encounter of spice and leather thrives under Finley''s touch. Violet leaf blooms next to cardamom in oh-so capable hands. Pistachio prospers with passion. A stable scent for a wild horse.',
      ARRAY['Pistachio'],
      ARRAY['Violet Leaf'],
      ARRAY['Leather'],
      ARRAY['Woody','Spicy'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/Finley%2075ml_Product_Web_PDP?$Transparent-png$&version=6c2712a8093853aa53b9f6b92b6f8f9f36610613',
      '[{"size":"75ml","price_min":350,"price_max":350,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'Elisabethan Rose',
      'The Tudor rose: symbol of Elizabethan England, immortalised in this airy scent. Inspired by the coming together of houses York and Lancaster, this airy eau de parfum is a harmonious union of rose, hazelnut leaf and vetiver.',
      ARRAY[]::text[],
      ARRAY['Hazelnut Leaf','Rose Centifolia','Vetiver'],
      ARRAY[]::text[],
      ARRAY['Floral'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/ELISABETHAN%20ROSE%20EDP%20100ML_Product_Web_PDP?$Transparent-png$&version=d41ea68c3a62456aff7f965c2ee5659f6a14cc41',
      '[{"size":"100ml","price_min":260,"price_max":260,"currency":"USD"},{"size":"30ml","price_min":125,"price_max":125,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'The Dandy',
      'Whisky. Glitter. Smoke. A cocktail of mischief, shaken with cedarwood and rhythmic raspberry. Let''s take it from the top. Whisky from the barrel on the rocks. Toes start tap-tapping to a melody of raspberry and bergamot. Now for the bass line: ambrox, oak, cedarwood and smoke.',
      ARRAY[]::text[],
      ARRAY['Whiskey Accord','Cedarwood','Oak'],
      ARRAY[]::text[],
      ARRAY['Woody'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/PEN_THE_DANDY_EDP%20_100ML_Product_Web_PDP?$Transparent-png$&version=5990246f517c50d35cd30128e14a0bfa829a40a4',
      '[{"size":"100ml","price_min":260,"price_max":260,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'Eau The Audacity',
      'A confident concoction imbibed with bold incense. A bottle of boldness to cast off the shackles of shyness. Audacious orange blossom surprises vanilla and incense — how fancy! Spritz sparingly (or not — we dare you).',
      ARRAY[]::text[],
      ARRAY['Black Pepper','Incense','Vanilla'],
      ARRAY[]::text[],
      ARRAY['Ambery','Leather'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/Potions_Eau_The_Audacity_Product_Web_PDP?$Transparent-png$&version=d2350b8b55fe3d62ab49318cfd619ed2b52ab7a2',
      '[{"size":"100ml","price_min":295,"price_max":295,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'Daphne Bouquet',
      'A joyful burst of blackcurrant leaf and daphne accord springs from a bed of moss. Created in collaboration with Highgrove Gardens, inspired by the daphne flower which blooms in the private residences of His Majesty King Charles III, in support of The King''s Foundation.',
      ARRAY['Blackcurrant Leaf'],
      ARRAY['Moss'],
      ARRAY['Daphne Accord'],
      ARRAY['Floral','Green'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/Daphne_Bouquet_100ml_bottle_Web_PDP?$Transparent-png$&version=f66626a07c315756c40218ca10eeafefdca1a9f4',
      '[{"size":"100ml","price_min":260,"price_max":260,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'Much Ado About the Duke',
      'Rose, gin, leather most uncommon. A scent to set Society tongues wagging. The handsome young Duke''s peppery rose fragrance sets hearts aflutter.',
      ARRAY['Pink Pepper'],
      ARRAY['Gin'],
      ARRAY['Vetiver'],
      ARRAY['Floral','Spicy','Woody'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/PORTRAITS%20THE%20DUKE%20EDP%2075ML_Product_Web_PDP?$Transparent-png$&version=258ec6393a7e2dbd80fd74024017d60506f9a86b',
      '[{"size":"75ml","price_min":350,"price_max":350,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'The Bewitching Yasmine',
      'Will Yasmine''s scent of jasmine, incense and oud help her lure a suitable match? Her amber fragrance is a voluptuous affair: jasmine, incense, oud. A celebration of all that is gloriously sensual.',
      ARRAY['Coffee','Jasmine'],
      ARRAY['Vanilla','Cardamom'],
      ARRAY['Oud','Incense'],
      ARRAY['Amber'],
      'women',
      'https://dynamic-assets.penhaligons.com/is/image/puig/PORTRAITS%20YASMINE%20EDP%2075%20ML_Product_Web_PDP?$Transparent-png$&version=cabc16d3d2ac470a7db7790d4664260c448af882',
      '[{"size":"75ml","price_min":350,"price_max":350,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'The Inimitable William Penhaligon',
      'He enters in a vetiver haze — warm, fresh and earthy. With a scent this good, there''s no wonder he''s the only trusted perfumer of High Society''s ladies and gents.',
      ARRAY[]::text[],
      ARRAY['Bergamot','Incense','Vetiver'],
      ARRAY[]::text[],
      ARRAY['Woody'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/WILLIAM%20PENHALIGON%2075ML_Product_Web_PDP?$Transparent-png$&version=96766ea44c7b5d3c47456a60dda07c42f33cf411',
      '[{"size":"75ml","price_min":350,"price_max":350,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'The World According to Arthur',
      'An incensed warrior in a sweet-scented garden of sage wisdom and wit. Arthur sheaths his silver spoon and words like a sword. Now, fresh from the East, he''s mastered sage wisdom. So, that devil Lord George best keep his brother sweet.',
      ARRAY[]::text[],
      ARRAY['Incense','Ambrette','Tonka Bean Absolute'],
      ARRAY[]::text[],
      ARRAY['Ambery','Spicy'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/PORTRAITS%20ARTHUR%2075ML%20EDP_Product_Web_PDP?$Transparent-png$&version=78eca39a8f94c2f21a5a5d741d6d7eedc6a71b30',
      '[{"size":"75ml","price_min":350,"price_max":350,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'Terrible Teddy',
      'Incense, leather and ambroxan. A smooth and deadly operator. Teddy lives for the thrill of the chase, ensnaring unsuspecting hearts with his scent of leather, incense and ambroxan.',
      ARRAY[]::text[],
      ARRAY['Incense','Leather','Vetiver'],
      ARRAY[]::text[],
      ARRAY['Leather','Spicy'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/TERRIBLE%20TEDDY%2075ML_Product_Web_PDP?$Transparent-png$&version=380051dc3c9a28a1cbe7a7178e0a3e0b45b6a38b',
      '[{"size":"75ml","price_min":350,"price_max":350,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'The Revenge of Lady Blanche',
      'A picture of charm — or is she? This narcotic fragrance has a dangerous bite. The dangerously charming Lady Blanche wields her beauty like a weapon. Fresh yet spicy. Floral and woody. This eau de parfum is criminally good.',
      ARRAY[]::text[],
      ARRAY['Daffodil','Orris','Sandalwood'],
      ARRAY[]::text[],
      ARRAY['Floral','Woody'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/PORTRAITS%20LADY%20BLANCHE%20EDP%2075ML_Product_Web_PDP?$Transparent-png$&version=d1902068a3799b29fba1b261436343968552249a',
      '[{"size":"75ml","price_min":350,"price_max":350,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'Solaris',
      'A timeless ode to the Sun, radiant with white flowers, dazzling citrus and blackcurrant. An ode to the sun, reaching through time and space. A lively citrus beams down to blend with powerful blackcurrant. Cedar, sandalwood and vanilla create an eau de parfum with uplifting strength and celestial grace.',
      ARRAY[]::text[],
      ARRAY['Blackcurrant','Ylang Ylang','Cedarwood'],
      ARRAY[]::text[],
      ARRAY['Floral','Citrus'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/Solaris_Product_Web_PDP?$Transparent-png$&version=ef76c7dcfe7f2d78b1c2d4718c11bdf813185852',
      '[{"size":"100ml","price_min":260,"price_max":260,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'Blenheim Bouquet',
      'A cocktail of lemon, black pepper and pine, fresh and fragrant as British wit. As dry and fresh as the best gin — or the best of British humour. First created for the Duke of Marlborough, and by jove it shows.',
      ARRAY['Lemon'],
      ARRAY['Lavender'],
      ARRAY['Pine'],
      ARRAY['Fresh'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/BLENHEIM%20BOUQUET%20EDT%20100ML_Product_Web_PDP?$Transparent-png$&version=31a4ba000d3af7c45365dc3bb1f14d1f64df8f2c',
      '[{"size":"100ml","price_min":210,"price_max":210,"currency":"USD"},{"size":"30ml","price_min":115,"price_max":115,"currency":"USD"}]'::jsonb,
      'edt'
    ),
    (
      'Endymion',
      'Classical elegance befitting of Zeus''s most handsome son. A sparkle of bergamot dances off suede, coffee and geranium. An eau de cologne for the ages. Who can resist a man such as this?',
      ARRAY['Bergamot','Suede'],
      ARRAY['Coffee Absolute','Geranium'],
      ARRAY['Sage','Frankincense'],
      ARRAY['Fresh','Citrus'],
      'men',
      'https://dynamic-assets.penhaligons.com/is/image/puig/ENDYMION_EDC_100ML_REPACK_Product_Web_PDP?$Transparent-png$&version=69d5b981e55afd0b2d3e9a27dcfead84f6558529',
      '[{"size":"100ml","price_min":210,"price_max":210,"currency":"USD"}]'::jsonb,
      'edc'
    ),
    (
      'The Favourite',
      'Mischief-tinged musk: this fragrance wields its own royally charming power. Golden mimosa sways society''s opinion with iris and musk on a sandalwood stage.',
      ARRAY['Mimosa'],
      ARRAY['Iris'],
      ARRAY['Musk','Sandalwood'],
      ARRAY['Floral'],
      'women',
      'https://dynamic-assets.penhaligons.com/is/image/puig/THE%20FAVOURITE%20EDP%20100ML_Product_Web_PDP?$Transparent-png$&version=9f3cc171177286c6200082f1c2b04d520724e2da',
      '[{"size":"100ml","price_min":260,"price_max":260,"currency":"USD"},{"size":"30ml","price_min":130,"price_max":130,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'Endymion Concentré',
      'Classical elegance befitting of Zeus''s most handsome son, intensified. A rich, dry leather accord deepens the cologne''s spirit. Who can resist a man such as this?',
      ARRAY[]::text[],
      ARRAY['Lavender','Suede','Leather'],
      ARRAY[]::text[],
      ARRAY['Woody','Leather'],
      'men',
      'https://dynamic-assets.penhaligons.com/is/image/puig/ENDYMIONCONCENTRE_EDP_100ML_Product_Web_PDP?$Transparent-png$&version=29dbac14116ae29a116dd148ac325966bd4f399a',
      '[{"size":"100ml","price_min":260,"price_max":260,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'Highgrove Bouquet',
      'A floral hum of silver lime, mimosa and cedar. As radiant as the scent of earthly sunshine. In Summer, Highgrove Gardens hum with a smell often described as earthly sunshine. The grass bows to weeping silver lime, mimosa, and cedar. Created in collaboration with Highgrove Gardens.',
      ARRAY[]::text[],
      ARRAY['Silver Lime Blossom','Mimosa','Cedar'],
      ARRAY[]::text[],
      ARRAY['Floral'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/Highgrove_EDP_100ML_PRODUCT?$Transparent-png$&version=ab04259bbb4da2dbb14380c0c36140bbcb567b56',
      '[{"size":"100ml","price_min":260,"price_max":260,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'Opus 1870',
      'A masterpiece of yuzu and incense. Classic, without ever being de rigueur. A delicate waft of incense meets invigorating yuzu — a bracing, brilliant fragrance, and not a bit heavy.',
      ARRAY[]::text[],
      ARRAY['Yuzu Fruit','Incense','Cedarwood'],
      ARRAY[]::text[],
      ARRAY['Woody','Spicy'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/OPUS%20EDT%20RPK%202017%20100ML_Product_Web_PDP?$Transparent-png$&version=95eca321a80abb902ded77375d55f0337c9a6666',
      '[{"size":"100ml","price_min":210,"price_max":210,"currency":"USD"}]'::jsonb,
      'edt'
    ),
    (
      'Babylon',
      'Love, mystery and majesty! A city fragrant with warm vanilla, cedar and saffron. Den of iniquity, or majestic wonder of the ancient world? No matter — Babylon''s scent is simply divine. Warm vanilla, distinguished cedar and decadent saffron.',
      ARRAY[]::text[],
      ARRAY['Cypriol','Saffron','Sandalwood'],
      ARRAY[]::text[],
      ARRAY['Amber','Woody'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/BABYLON%20EDP%20100ML_Product_Web_PDP?$Transparent-png$&version=c2d35ebcabc75834d042c8cf5e68bc1e3ffddbb7',
      '[{"size":"100ml","price_min":330,"price_max":330,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'Vra Vra Vroom',
      'Dash it all and make haste! An energetic blast of mandarin and magnolia, enthusiastic spoonfuls of osmanthus absolute. Spritz your way to success. Nothing shall stop one now.',
      ARRAY[]::text[],
      ARRAY['Apricot','Leather','Osmanthus'],
      ARRAY[]::text[],
      ARRAY['Floral','Fruity'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/Potions_Vra_Vra_Vroom_Product_Web_PDP?$Transparent-png$&version=85b9f8971f986cce846666db3539a96c2395011d',
      '[{"size":"100ml","price_min":295,"price_max":295,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'A Kiss of Bliss',
      'Spritz those blues away with bergamot and green clover. Musk and rose sing from the hilltops: would one like to join? An eau de parfum borne from sunny days to have you dancing all night long.',
      ARRAY[]::text[],
      ARRAY['Musk','Clover','Jasmine'],
      ARRAY[]::text[],
      ARRAY['Chypre','Musk'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/Potions_A%20_Kiss_of_Bliss_Product_Web_PDP?$Transparent-png$&version=9aa0c5feba072dbb0e8a644fab416fd71e057b53',
      '[{"size":"100ml","price_min":295,"price_max":295,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'Bold Blend',
      'Why play it safe? Peppermint jumps. Black pepper jolts. Palo santo pushes boundaries you never knew you had. Climb higher with violet leaf and clary sage with a scent that says yes (before you overthink it).',
      ARRAY['Peppermint','Black Pepper','Violet Leaf'],
      ARRAY['Clary Sage','Palo Santo Accord'],
      ARRAY['Cypress','Cypriol'],
      ARRAY['Fresh'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/Bold_Blends_50ml_Product_Web_PDP?$Transparent-png$&version=b264143aca107ed96d75e62cf475cee86b2328a6',
      '[{"size":"50ml","price_min":200,"price_max":200,"currency":"USD"},{"size":"100ml","price_min":400,"price_max":400,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'Liquid Love',
      'A passionate eau de parfum to set hearts a-flutter. Spicy rushes of pink pepper, ginger and turmeric lock in fiery embrace with chilli and musk. Be warned: one spritz too many may cause swooning.',
      ARRAY[]::text[],
      ARRAY['Rose','Sandalwood','Ginger'],
      ARRAY[]::text[],
      ARRAY['Floral','Spicy'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/PEN_2025_Liquid_Love_50ml_Product_Web_PDP?$Transparent-png$&version=e959962d1a9f145fed09644c967c9eb67a1b75bb',
      '[{"size":"50ml","price_min":200,"price_max":200,"currency":"USD"},{"size":"100ml","price_min":400,"price_max":400,"currency":"USD"}]'::jsonb,
      'edp'
    ),
    (
      'A Balm of Calm',
      'A lullaby of lavender, a cloud of geranium. Iris and sandalwood for a dose of composure — an instant serenity remedy. Rum and soft woods round off this tranquillity blend. Heaven.',
      ARRAY[]::text[],
      ARRAY['Geranium','Lavender','Sandalwood'],
      ARRAY[]::text[],
      ARRAY['Floral','Aromatic'],
      'unisex',
      'https://dynamic-assets.penhaligons.com/is/image/puig/PEN_2025_A_Balm_of_Calm_50ml_Product_Web_PDP?$Transparent-png$&version=011ebbe5659fe4ff141cb26b902628459d6be9d3',
      '[{"size":"50ml","price_min":200,"price_max":200,"currency":"USD"},{"size":"100ml","price_min":295,"price_max":295,"currency":"USD"}]'::jsonb,
      'edp'
    )
),
-- Update rows that already exist
updated AS (
  UPDATE public.perfumes p
  SET
    description      = d.description,
    top_notes        = d.top_notes,
    heart_notes      = d.heart_notes,
    base_notes       = d.base_notes,
    fragrance_family = d.fragrance_family,
    gender           = d.gender,
    image_url        = d.image_url,
    prices           = d.prices,
    product_type     = d.product_type
  FROM data d
  WHERE lower(p.brand) = 'penhaligon''s' AND lower(p.name) = lower(d.name)
  RETURNING p.name
)
-- Insert rows that do not exist yet
INSERT INTO public.perfumes
  (id, name, brand, description, top_notes, heart_notes, base_notes,
   fragrance_family, gender, image_url, prices, product_type, created_at)
SELECT
  uuid_generate_v4(), d.name, 'Penhaligon''s',
  d.description, d.top_notes, d.heart_notes, d.base_notes,
  d.fragrance_family, d.gender, d.image_url, d.prices, d.product_type, now()
FROM data d
WHERE NOT EXISTS (SELECT 1 FROM updated u WHERE lower(u.name) = lower(d.name))
  AND NOT EXISTS (
    SELECT 1 FROM public.perfumes p
    WHERE lower(p.brand) = 'penhaligon''s' AND lower(p.name) = lower(d.name)
  );

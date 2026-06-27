-- Railway PostgreSQL Schema for Hallie
-- Run this AFTER importing Supabase data (pg_dump / pg_restore)
-- or run it on a fresh DB and omit the data migration step.

-- ─── Users (replaces Supabase auth.users) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,  -- UUID stored as text (NextAuth JWT sub)
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  image       TEXT,
  password_hash TEXT,            -- NULL for Google-only accounts
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── Push subscriptions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- ─── Perfumes catalog ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS perfumes (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name             TEXT NOT NULL,
  brand            TEXT NOT NULL,
  year             INTEGER,
  description      TEXT,
  top_notes        TEXT[] DEFAULT '{}',
  heart_notes      TEXT[] DEFAULT '{}',
  base_notes       TEXT[] DEFAULT '{}',
  full_ingredients TEXT,
  fragrance_family TEXT[] DEFAULT '{}',
  gender           TEXT,
  image_url        TEXT,
  prices           JSONB DEFAULT '[]',
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(name, brand)
);

-- ─── User perfumes (custom / unlisted) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_perfumes (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  brand            TEXT NOT NULL,
  year             INTEGER,
  description      TEXT,
  top_notes        TEXT[] DEFAULT '{}',
  heart_notes      TEXT[] DEFAULT '{}',
  base_notes       TEXT[] DEFAULT '{}',
  fragrance_family TEXT[] DEFAULT '{}',
  gender           TEXT,
  image_url        TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name, brand)
);

-- ─── Collection items ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collection_items (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  perfume_id        TEXT REFERENCES perfumes(id) ON DELETE SET NULL,
  user_perfume_id   TEXT REFERENCES user_perfumes(id) ON DELETE SET NULL,
  collection_type   TEXT NOT NULL CHECK (collection_type IN ('closet','wishlist','owned_before')),
  bottle_sizes      TEXT[] DEFAULT '{}',
  size_prices       JSONB DEFAULT '[]',
  occasions         TEXT[] DEFAULT '{}',
  seasons           TEXT[] DEFAULT '{}',
  rating            NUMERIC(3,1),
  notes             TEXT,
  initial_level     TEXT DEFAULT 'full',
  estimated_level   TEXT DEFAULT 'full',
  available_for_swap BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ─── Scent logs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scent_logs (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_item_ids  TEXT[] DEFAULT '{}',
  date                 DATE NOT NULL DEFAULT CURRENT_DATE,
  mood                 TEXT[] DEFAULT '{}',
  event_type           TEXT,
  event_types          TEXT[] DEFAULT '{}',
  rating               NUMERIC(3,1),
  duration             TEXT,
  notes                TEXT,
  got_compliment       BOOLEAN DEFAULT false,
  spray_intensities    JSONB DEFAULT '{}',
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- ─── Layer combos ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS layer_combos (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 TEXT,
  collection_item_ids  TEXT[] DEFAULT '{}',
  perfume_names        TEXT[] DEFAULT '{}',
  occasion             TEXT[] DEFAULT '{}',
  season               TEXT[] DEFAULT '{}',
  mood                 TEXT[] DEFAULT '{}',
  intensity_longevity  INTEGER DEFAULT 5,
  intensity_sillage    INTEGER DEFAULT 5,
  combined_profile     TEXT,
  saved                BOOLEAN DEFAULT false,
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- ─── Badges ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badges (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL,
  icon             TEXT NOT NULL,
  threshold_type   TEXT NOT NULL,
  threshold_value  INTEGER NOT NULL
);

INSERT INTO badges (name, description, icon, threshold_type, threshold_value) VALUES
  ('First Spritz',      'Added your first perfume to the collection', '🌸', 'collection_count', 1),
  ('Growing Collection','Added 10 perfumes to your closet',           '🌷', 'collection_count', 10),
  ('Connoisseur',       'Added 25 perfumes to your collection',       '🏺', 'collection_count', 25),
  ('Century Club',      'Logged 100 scent entries',                   '📖', 'log_count',        100),
  ('Daily Devotee',     'Logged scents 30 days in a row',             '📅', 'streak_days',      30),
  ('Note Explorer',     'Tried all major fragrance families',          '🌍', 'families_explored', 10),
  ('Layering Artist',   'Created 10 perfume combinations',             '🎨', 'combo_count',      10),
  ('Scent Sharer',      'Listed a perfume for swap',                   '🤝', 'swap_count',       1),
  ('Niche Devotee',     'Added 5 niche brand perfumes',                '💎', 'niche_count',      5)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS user_badges (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id   TEXT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

-- ─── Swap listings ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS swap_listings (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_item_id TEXT NOT NULL REFERENCES collection_items(id) ON DELETE CASCADE,
  status             TEXT DEFAULT 'available' CHECK (status IN ('available','pending','completed')),
  description        TEXT,
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- ─── Compliment entries ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS compliment_entries (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_item_ids TEXT[] DEFAULT '{}',
  perfume_names       TEXT[] DEFAULT '{}',
  date                DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ─── Beauty products ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS beauty_products (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name             TEXT NOT NULL,
  brand            TEXT NOT NULL,
  category         TEXT,
  subcategory      TEXT,
  fragrance_family TEXT[] DEFAULT '{}',
  notes            TEXT[] DEFAULT '{}',
  full_ingredients TEXT,
  image_url        TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ─── Recommendations cache ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_recommendations (
  user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  recommendations JSONB NOT NULL DEFAULT '[]',
  cached_at       TIMESTAMPTZ DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_collection_items_user       ON collection_items (user_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_type       ON collection_items (user_id, collection_type);
CREATE INDEX IF NOT EXISTS idx_scent_logs_user_date        ON scent_logs (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_swap_listings_status        ON swap_listings (status);
CREATE INDEX IF NOT EXISTS idx_user_perfumes_user          ON user_perfumes (user_id);
CREATE INDEX IF NOT EXISTS idx_perfumes_name_brand         ON perfumes (name, brand);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user     ON push_subscriptions (user_id);

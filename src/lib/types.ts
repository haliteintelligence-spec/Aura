export interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Perfume {
  id: string;
  name: string;
  brand: string;
  year: number | null;
  description: string | null;
  top_notes: string[];
  heart_notes: string[];
  base_notes: string[];
  fragrance_family: string[];
  gender: string | null;
  image_url: string | null;
  created_at: string;
}

export interface UserPerfume {
  id: string;
  user_id: string;
  name: string;
  brand: string;
  year: number | null;
  description: string | null;
  top_notes: string[];
  heart_notes: string[];
  base_notes: string[];
  fragrance_family: string[];
  gender: string | null;
  image_url: string | null;
  product_type: string | null;
  created_at: string;
}

export interface BottleSizePrice {
  size: string;
  price_min: number | null;
  price_max: number | null;
  currency: string;
}

export interface CollectionItem {
  id: string;
  user_id: string;
  perfume_id: string;
  perfume?: Perfume;
  user_perfume?: UserPerfume;
  collection_type: "closet" | "wishlist" | "owned_before";
  bottle_sizes: string[];
  size_prices: BottleSizePrice[];
  occasions: string[];
  seasons: string[];
  rating: number | null;
  notes: string | null;
  initial_level: string;
  estimated_level: string;
  available_for_swap: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScentLog {
  id: string;
  user_id: string;
  collection_item_ids: string[];
  collection_items?: CollectionItem[];
  date: string;
  mood: string[];
  event_type: string;
  event_types: string[];
  rating: number;
  duration: string;
  notes: string | null;
  got_compliment: boolean;
  created_at: string;
}

export interface ComplimentEntry {
  id: string;
  user_id: string;
  collection_item_ids: string[];
  perfume_names: string[];
  date: string;
  created_at: string;
}

export interface LayerCombo {
  id: string;
  user_id: string;
  name: string | null;
  collection_item_ids: string[];
  collection_items?: CollectionItem[];
  perfume_names: string[];
  occasion: string[];
  season: string[];
  mood: string[];
  intensity_longevity: number;
  intensity_sillage: number;
  combined_profile: string;
  saved: boolean;
  created_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  threshold_type: string;
  threshold_value: number;
}

export interface UserBadge {
  user_id: string;
  badge_id: string;
  badge?: Badge;
  earned_at: string;
}

export interface SwapListing {
  id: string;
  user_id: string;
  collection_item_id: string;
  collection_item?: CollectionItem;
  profile?: User;
  status: "available" | "pending" | "completed";
  description: string | null;
  created_at: string;
}

export interface PerfumeSearchResult {
  id?: string;
  name: string;
  brand: string;
  year?: number;
  description?: string;
  top_notes: string[];
  heart_notes: string[];
  base_notes: string[];
  fragrance_family: string[];
  gender?: string;
  image_url?: string;
  confidence?: number;
}

export interface PriceResult {
  size: string;
  price_min: number | null;
  price_max: number | null;
  currency: string;
  source?: string;
}

export type BeautyCategory = "skincare" | "bodycare" | "haircare" | "candle" | "home_fragrance" | "fragrance" | "other";

export interface BeautyProduct {
  id?: string;
  name: string;
  brand: string;
  category: BeautyCategory;
  subcategory?: string;
  description?: string;
  key_ingredients?: string[];
  full_ingredients?: string;
  scent_notes?: string[];
  image_url?: string;
  prices?: Array<{ size: string; price_min: number | null; price_max: number | null; currency: string }>;
  tags?: string[];
  source_url?: string;
}

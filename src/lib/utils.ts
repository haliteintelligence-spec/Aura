import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function levelToFraction(level: string): number {
  const map: Record<string, number> = {
    "full": 1,
    "7/8": 0.875,
    "3/4": 0.75,
    "5/8": 0.625,
    "1/2": 0.5,
    "3/8": 0.375,
    "1/4": 0.25,
    "1/8": 0.125,
    "empty": 0,
  };
  return map[level] ?? 1;
}

export function fractionToLevel(fraction: number): string {
  if (fraction >= 0.95) return "full";
  if (fraction >= 0.81) return "7/8";
  if (fraction >= 0.69) return "3/4";
  if (fraction >= 0.56) return "5/8";
  if (fraction >= 0.44) return "1/2";
  if (fraction >= 0.31) return "3/8";
  if (fraction >= 0.19) return "1/4";
  if (fraction > 0.05) return "1/8";
  return "empty";
}

export const BOTTLE_SIZES = [
  { label: "Sample (1-2ml)", value: "sample", ml: 1.5 },
  { label: "Travel (5ml)", value: "travel_5ml", ml: 5 },
  { label: "Travel (10ml)", value: "travel_10ml", ml: 10 },
  { label: "30ml / 1 oz", value: "30ml", ml: 30 },
  { label: "50ml / 1.7 oz", value: "50ml", ml: 50 },
  { label: "75ml / 2.5 oz", value: "75ml", ml: 75 },
  { label: "100ml / 3.4 oz", value: "100ml", ml: 100 },
  { label: "125ml / 4.2 oz", value: "125ml", ml: 125 },
  { label: "200ml / 6.7 oz", value: "200ml", ml: 200 },
  { label: "Other", value: "other", ml: 0 },
];

export const PRODUCT_LEVELS = [
  "full", "7/8", "3/4", "5/8", "1/2", "3/8", "1/4", "1/8",
];

export const SEASONS = ["Spring", "Summer", "Autumn", "Winter"];

export const OCCASIONS = [
  "Everyday",
  "Work / Office",
  "Date Night",
  "Formal / Black Tie",
  "Casual Outing",
  "Sport / Gym",
  "Travel",
  "Beach / Pool",
  "Night Out",
  "At-Home / Bedtime",
  "Special Occasion",
  "Weekend",
];

export const MOODS = [
  "Happy", "Romantic", "Confident", "Relaxed", "Energized",
  "Mysterious", "Fresh", "Cozy", "Bold", "Playful",
];

export const EVENT_TYPES = [
  "Daily Wear",
  "Work",
  "Date",
  "Dinner",
  "Party / Night Out",
  "Workout",
  "Travel",
  "Special Event",
  "Staying In",
  "Casual",
];

export const DURATION_RANGES = [
  { label: "Under 2 hours", value: "under_2h" },
  { label: "2–4 hours", value: "2_4h" },
  { label: "4–6 hours", value: "4_6h" },
  { label: "6–8 hours", value: "6_8h" },
  { label: "8–10 hours", value: "8_10h" },
  { label: "10+ hours", value: "10h_plus" },
];

export const FRAGRANCE_FAMILIES = [
  "Floral", "Woody", "Oriental / Amber", "Fresh / Citrus",
  "Fougère", "Chypre", "Gourmand", "Aquatic", "Aromatic",
  "Green", "Fruity", "Powdery", "Leather", "Spicy",
];

export const COLLECTION_TYPES = [
  { value: "closet", label: "Perfume Closet" },
  { value: "wishlist", label: "Wishlist" },
  { value: "owned_before", label: "Owned Before" },
] as const;

export type CollectionType = "closet" | "wishlist" | "owned_before";
